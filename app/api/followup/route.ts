import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContactStatus, CustomerTag, Platform } from '@prisma/client'
import { type Category, buildWhere, buildOrderBy } from '@/lib/followup-query'

const LIMIT = 25

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const search        = sp.get('search') ?? ''
  const contactStatus = sp.get('status') as ContactStatus | null
  const tag           = sp.get('tag') as CustomerTag | null
  const platform      = sp.get('platform') as Platform | null
  const category      = (sp.get('category') ?? 'semua') as Category
  const page          = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const noFrom        = parseInt(sp.get('noFrom') ?? '0') || 0
  const noTo          = parseInt(sp.get('noTo') ?? '0') || 0

  const where = buildWhere({ platform, search, tag, contactStatus, category })
  const orderBy = buildOrderBy(category)

  // noFrom/noTo override page-based pagination for row-range slicing
  const useRange = noFrom > 0 && noTo >= noFrom
  const skip = useRange ? noFrom - 1 : (page - 1) * LIMIT
  const take = useRange ? noTo - noFrom + 1 : LIMIT
  const rowOffset = useRange ? noFrom : (page - 1) * LIMIT + 1

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        followUp: { include: { followedUpBy: { select: { name: true } } } },
        orders:   { orderBy: { orderDate: 'desc' }, take: 1, select: { status: true, orderDate: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  const result = customers.map(({ orders, ...c }) => ({
    ...c,
    lastOrderStatus: orders[0]?.status ?? null,
  }))

  return NextResponse.json({
    customers:  result,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
    rowOffset,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerId, contactStatus, responseNote } = body

  if (!customerId || !contactStatus) {
    return NextResponse.json({ error: 'customerId and contactStatus required' }, { status: 400 })
  }

  const userId = (session.user as { id?: string }).id

  const followUp = await prisma.followUp.upsert({
    where: { customerId },
    update:  { contactStatus, responseNote: responseNote ?? undefined, followedUpById: userId, followedUpAt: new Date() },
    create:  { customerId, contactStatus, responseNote: responseNote ?? undefined, followedUpById: userId, followedUpAt: new Date() },
  })

  return NextResponse.json(followUp)
}
