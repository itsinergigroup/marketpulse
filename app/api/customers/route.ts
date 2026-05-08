import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CustomerTag, Platform } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const tag = searchParams.get('tag') as CustomerTag | null
  const platform = searchParams.get('platform') as Platform | null
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ],
    }),
    ...(tag && { tag }),
    ...(platform && { platform }),
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { totalSpend: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        followUp: { select: { contactStatus: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  return NextResponse.json({ customers, total, page, totalPages: Math.ceil(total / limit) })
}
