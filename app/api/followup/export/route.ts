import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContactStatus, CustomerTag, Platform } from '@prisma/client'
import ExcelJS from 'exceljs'
import { buildWhere, buildOrderBy, type Category } from '@/lib/followup-query'

const contactStatusLabels: Record<ContactStatus, string> = {
  belum_dihubungi:  'Belum Dihubungi',
  menunggu_balasan: 'Menunggu Balasan',
  terkontак:        'Terkontак',
  diabaikan:        'Diabaikan',
  gagal_hubungi:    'Gagal Hubungi',
}

const tagLabels: Record<CustomerTag, string> = {
  new:      'Baru',
  repeat:   'Repeat',
  vip:      'VIP',
  at_risk:  'At Risk',
  lost:     'Lost',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp            = req.nextUrl.searchParams
  const search        = sp.get('search') ?? ''
  const contactStatus = sp.get('status') as ContactStatus | null
  const tag           = sp.get('tag') as CustomerTag | null
  const platform      = sp.get('platform') as Platform | null
  const category      = (sp.get('category') ?? 'semua') as Category

  const where   = buildWhere({ platform, search, tag, contactStatus, category })
  const orderBy = buildOrderBy(category)

  const customers = await prisma.customer.findMany({
    where,
    orderBy,
    include: {
      followUp: true,
      orders:   { orderBy: { orderDate: 'desc' }, take: 1, select: { status: true } },
    },
  })

  // ─── Build xlsx ──────────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'MarketPulse'
  wb.created  = new Date()

  const ws = wb.addWorksheet('Follow-Up')

  ws.columns = [
    { header: 'No',                      key: 'no',          width: 5  },
    { header: 'Username',                key: 'name',        width: 20 },
    { header: 'Platform',                key: 'platform',    width: 10 },
    { header: 'Tag',                     key: 'tag',         width: 12 },
    { header: 'Total Pesanan',           key: 'orders',      width: 15 },
    { header: 'Total Belanja',           key: 'spend',       width: 18 },
    { header: 'Terakhir Beli',           key: 'lastOrder',   width: 18 },
    { header: 'Status Kontak',           key: 'status',      width: 20 },
    { header: 'Catatan',                 key: 'note',        width: 30 },
    { header: 'Status Terakhir Pesanan', key: 'orderStatus', width: 20 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  headerRow.height = 20
  headerRow.commit()

  // Data rows
  customers.forEach(({ orders, followUp, ...c }, idx) => {
    const row = ws.addRow({
      no:          idx + 1,
      name:        c.name,
      platform:    c.platform,
      tag:         tagLabels[c.tag] ?? c.tag,
      orders:      c.totalOrders,
      spend:       c.totalSpend,
      lastOrder:   c.lastOrderDate
        ? new Date(c.lastOrderDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-',
      status:      contactStatusLabels[followUp?.contactStatus ?? 'belum_dihubungi'],
      note:        followUp?.responseNote ?? '',
      orderStatus: orders[0]?.status ?? '',
    })

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
      })
    }

    row.commit()
  })

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer   = await wb.xlsx.writeBuffer()
  const fileName = `followup-export-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
