import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Platform } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search   = searchParams.get('search') ?? ''
    const platform = searchParams.get('platform') as Platform | null
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit    = 20

    const where = {
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { productName: { contains: search, mode: 'insensitive' as const } },
          { customer:    { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(platform && { platform }),
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: { customer: { select: { id: true, name: true, phone: true, tag: true } } },
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Orders API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
