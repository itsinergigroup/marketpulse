import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Platform } from '@prisma/client'

export type Movement = 'fast' | 'normal' | 'slow'

function classifyMovement(orderCount: number, ordersLast30Days: number): Movement {
  if (ordersLast30Days >= 10 || orderCount >= 50) return 'fast'
  if (ordersLast30Days >= 3  || orderCount >= 10) return 'normal'
  return 'slow'
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp       = req.nextUrl.searchParams
    const mode     = sp.get('mode') ?? 'table'
    const platform = sp.get('platform') as Platform | null
    const sortBy   = sp.get('sortBy') ?? 'count'        // count | revenue | latest
    const search   = sp.get('search') ?? ''
    const movement = sp.get('movement') ?? ''            // fast | normal | slow | ''
    const page     = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const limit    = Math.max(1, parseInt(sp.get('limit') ?? '25'))

    const platformFilter = platform ? { platform } : {}
    const searchFilter   = search   ? { productName: { contains: search, mode: 'insensitive' as const } } : {}

    // ── KPI ──────────────────────────────────────────────────────────────────
    if (mode === 'kpi') {
      const [distinctRows, totalCount, aggResult, topProducts] = await Promise.all([
        prisma.order.findMany({
          distinct: ['productName'],
          select:   { productName: true },
          where:    platformFilter,
        }),
        prisma.order.count({ where: platformFilter }),
        prisma.order.aggregate({ where: platformFilter, _avg: { totalAmount: true } }),
        prisma.order.groupBy({
          by:       ['productName'],
          where:    platformFilter,
          _count:   { _all: true },
          orderBy:  { _count: { productName: 'desc' } },
          take:     1,
        }),
      ])

      return NextResponse.json({
        uniqueProducts:   distinctRows.length,
        totalTransactions: totalCount,
        avgOrderValue:    aggResult._avg.totalAmount ?? 0,
        topProduct:       topProducts[0]?.productName ?? '-',
        topProductCount:  topProducts[0]?._count._all ?? 0,
      })
    }

    // ── Chart (top N products) ────────────────────────────────────────────────
    if (mode === 'chart') {
      const chartLimit = Math.max(1, parseInt(sp.get('limit') ?? '10'))

      const groups = await prisma.order.groupBy({
        by:      ['productName'],
        where:   platformFilter,
        _count:  { _all: true },
        _sum:    { totalAmount: true },
        orderBy: sortBy === 'revenue'
          ? { _sum: { totalAmount: 'desc' } }
          : { _count: { productName: 'desc' } },
        take: chartLimit,
      })

      return NextResponse.json({
        products: groups.map((g) => ({
          productName:  g.productName,
          orderCount:   g._count._all,
          totalRevenue: g._sum.totalAmount ?? 0,
        })),
      })
    }

    // ── FSN Table ─────────────────────────────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    const where = { ...platformFilter, ...searchFilter }

    const [groups, recentGroups] = await Promise.all([
      prisma.order.groupBy({
        by:     ['productName', 'platform'],
        where,
        _count: { _all: true },
        _sum:   { totalAmount: true },
        _max:   { orderDate: true },
      }),
      prisma.order.groupBy({
        by:     ['productName', 'platform'],
        where:  { ...where, orderDate: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
    ])

    const recentMap = new Map<string, number>()
    for (const r of recentGroups) {
      recentMap.set(`${r.productName}|||${r.platform}`, r._count._all)
    }

    let classified = groups.map((g) => {
      const recent = recentMap.get(`${g.productName}|||${g.platform}`) ?? 0
      return {
        productName:      g.productName,
        platform:         g.platform as Platform,
        orderCount:       g._count._all,
        totalRevenue:     g._sum.totalAmount ?? 0,
        lastSoldDate:     g._max.orderDate ?? new Date(),
        ordersLast30Days: recent,
        movement:         classifyMovement(g._count._all, recent),
      }
    })

    // Movement filter
    if (movement === 'fast' || movement === 'normal' || movement === 'slow') {
      classified = classified.filter((p) => p.movement === movement)
    }

    // Sort
    if (sortBy === 'revenue') {
      classified.sort((a, b) => b.totalRevenue - a.totalRevenue)
    } else if (sortBy === 'latest') {
      classified.sort((a, b) => new Date(b.lastSoldDate).getTime() - new Date(a.lastSoldDate).getTime())
    } else {
      classified.sort((a, b) => b.orderCount - a.orderCount)
    }

    const total    = classified.length
    const paginated = classified.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      products:   paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('Products API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
