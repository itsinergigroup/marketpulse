import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Platform, Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp       = req.nextUrl.searchParams
    const name     = sp.get('name') ?? ''
    const platform = sp.get('platform') as Platform | null

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const where = {
      productName: name,
      ...(platform ? { platform } : {}),
    }

    const [orders, agg, monthly] = await Promise.all([
      // Recent 50 orders
      prisma.order.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        take:    50,
        include: { customer: { select: { name: true } } },
      }),

      // Aggregate stats
      prisma.order.aggregate({
        where,
        _count: { _all: true },
        _sum:   { totalAmount: true },
        _avg:   { totalAmount: true },
      }),

      // Monthly counts — last 6 months
      (async () => {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

        const rows = await prisma.$queryRaw<{ month: string; count: number; revenue: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "orderDate"), 'YYYY-MM') AS month,
            COUNT(*)::int AS count,
            COALESCE(SUM("totalAmount"), 0)::float AS revenue
          FROM "Order"
          WHERE "productName" = ${name}
            AND "orderDate" >= ${sixMonthsAgo}
            ${platform ? Prisma.sql`AND "platform" = ${platform}::"Platform"` : Prisma.sql``}
          GROUP BY DATE_TRUNC('month', "orderDate")
          ORDER BY DATE_TRUNC('month', "orderDate") ASC
        `
        return rows
      })(),
    ])

    return NextResponse.json({
      stats: {
        totalOrders:   agg._count._all,
        totalRevenue:  agg._sum.totalAmount ?? 0,
        avgOrderValue: agg._avg.totalAmount ?? 0,
      },
      monthly,
      orders: orders.map((o) => ({
        id:           o.id,
        orderNumber:  o.orderNumber,
        platform:     o.platform,
        customerName: o.customer.name,
        orderDate:    o.orderDate,
        totalAmount:  o.totalAmount,
        status:       o.status,
      })),
    })
  } catch (err) {
    console.error('Product history API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
