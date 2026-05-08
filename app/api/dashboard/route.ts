import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const [
    totalCustomers,
    totalOrders,
    revenueResult,
    newCustomers,
    recentOrders,
    topCustomers,
    ordersByDay,
    customersByTag,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.findMany({
      take: 10,
      orderBy: { orderDate: 'desc' },
      include: { customer: true },
    }),
    prisma.customer.findMany({
      take: 5,
      orderBy: { totalSpend: 'desc' },
    }),
    prisma.order.groupBy({
      by: ['orderDate'],
      _sum: { totalAmount: true },
      _count: true,
      where: { orderDate: { gte: thirtyDaysAgo } },
      orderBy: { orderDate: 'asc' },
    }),
    prisma.customer.groupBy({
      by: ['tag'],
      _count: true,
    }),
  ])

  const prevMonthOrders = await prisma.order.count({
    where: { orderDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
  })
  const currMonthOrders = await prisma.order.count({
    where: { orderDate: { gte: thirtyDaysAgo } },
  })

  return NextResponse.json({
    kpi: {
      totalCustomers,
      totalOrders,
      totalRevenue: revenueResult._sum.totalAmount ?? 0,
      newCustomers,
      orderGrowth:
        prevMonthOrders > 0
          ? Math.round(((currMonthOrders - prevMonthOrders) / prevMonthOrders) * 100)
          : 0,
    },
    recentOrders,
    topCustomers,
    charts: {
      ordersByDay,
      customersByTag,
    },
  })
}
