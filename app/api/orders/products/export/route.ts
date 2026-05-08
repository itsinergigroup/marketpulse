import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Platform } from '@prisma/client'
import ExcelJS from 'exceljs'

type Movement = 'fast' | 'normal' | 'slow'

function classifyMovement(orderCount: number, ordersLast30Days: number): Movement {
  if (ordersLast30Days >= 10 || orderCount >= 50) return 'fast'
  if (ordersLast30Days >= 3  || orderCount >= 10) return 'normal'
  return 'slow'
}

function fmtRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

const movementLabel: Record<Movement, string> = {
  fast:   'Fast Moving',
  normal: 'Normal',
  slow:   'Slow Moving',
}

// Row fill per movement
const movementFill: Record<Movement, string> = {
  fast:   'FFd4edda',
  normal: 'FFcce5ff',
  slow:   'FFf8d7da',
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp       = req.nextUrl.searchParams
    const platform = sp.get('platform') as Platform | null
    const sortBy   = sp.get('sortBy') ?? 'count'
    const search   = sp.get('search') ?? ''
    const movement = sp.get('movement') ?? ''

    const platformFilter = platform ? { platform } : {}
    const searchFilter   = search   ? { productName: { contains: search, mode: 'insensitive' as const } } : {}
    const where          = { ...platformFilter, ...searchFilter }
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 86_400_000)

    const [groups, recentGroups] = await Promise.all([
      prisma.order.groupBy({
        by:     ['productName', 'platform'],
        where,
        _count: { _all: true },
        _sum:   { totalAmount: true },
        _avg:   { totalAmount: true },
        _max:   { orderDate: true },
      }),
      prisma.order.groupBy({
        by:    ['productName', 'platform'],
        where: { ...where, orderDate: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
    ])

    const recentMap = new Map<string, number>()
    for (const r of recentGroups) recentMap.set(`${r.productName}|||${r.platform}`, r._count._all)

    let rows = groups.map((g) => {
      const recent = recentMap.get(`${g.productName}|||${g.platform}`) ?? 0
      return {
        productName:      g.productName,
        platform:         g.platform,
        orderCount:       g._count._all,
        totalRevenue:     g._sum.totalAmount ?? 0,
        avgOrderValue:    g._avg.totalAmount ?? 0,
        lastSoldDate:     g._max.orderDate ?? new Date(),
        ordersLast30Days: recent,
        movement:         classifyMovement(g._count._all, recent),
      }
    })

    // Filter + sort
    if (movement === 'fast' || movement === 'normal' || movement === 'slow') {
      rows = rows.filter((r) => r.movement === movement)
    }
    if (sortBy === 'revenue') rows.sort((a, b) => b.totalRevenue - a.totalRevenue)
    else if (sortBy === 'latest') rows.sort((a, b) => new Date(b.lastSoldDate).getTime() - new Date(a.lastSoldDate).getTime())
    else rows.sort((a, b) => b.orderCount - a.orderCount)

    // ── Build xlsx ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'MarketPulse'
    wb.created = new Date()

    const ws = wb.addWorksheet('FSN Produk')
    ws.columns = [
      { header: 'No',                key: 'no',        width: 5  },
      { header: 'Nama Produk',       key: 'name',      width: 35 },
      { header: 'Platform',          key: 'platform',  width: 12 },
      { header: 'Total Terjual',     key: 'count',     width: 15 },
      { header: 'Total Revenue',     key: 'revenue',   width: 20 },
      { header: 'Rata-rata Nilai',   key: 'avg',       width: 20 },
      { header: 'Terakhir Terjual',  key: 'lastSold',  width: 18 },
      { header: 'Terjual 30 Hari',   key: 'recent',    width: 15 },
      { header: 'Klasifikasi',       key: 'movement',  width: 15 },
    ]

    // Header row styling
    const hdr = ws.getRow(1)
    hdr.eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })
    hdr.height = 20
    hdr.commit()

    // Data rows
    rows.forEach((r, idx) => {
      const row = ws.addRow({
        no:       idx + 1,
        name:     r.productName,
        platform: r.platform,
        count:    r.orderCount,
        revenue:  fmtRupiah(r.totalRevenue),
        avg:      fmtRupiah(r.avgOrderValue),
        lastSold: new Date(r.lastSoldDate).toLocaleDateString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        recent:   r.ordersLast30Days,
        movement: movementLabel[r.movement],
      })
      const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: movementFill[r.movement] } }
      row.eachCell((cell) => { cell.fill = fill })
      row.commit()
    })

    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const buffer   = await wb.xlsx.writeBuffer()
    const fileName = `fsn-produk-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('FSN export error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
