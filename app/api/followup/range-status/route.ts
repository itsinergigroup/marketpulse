import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContactStatus, CustomerTag, Platform } from '@prisma/client'
import { type Category, buildWhere, buildOrderBy } from '@/lib/followup-query'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    from,
    to,
    contactStatus,   // new status to SET
    platform,
    category,
    search,
    tag,
    statusFilter,    // current contact-status FILTER (may differ from contactStatus)
  } = body as {
    from:          number
    to:            number
    contactStatus: ContactStatus
    platform?:     Platform
    category?:     Category
    search?:       string
    tag?:          CustomerTag
    statusFilter?: ContactStatus
  }

  if (!from || !to || !contactStatus) {
    return NextResponse.json({ error: 'from, to, contactStatus required' }, { status: 400 })
  }
  if (from < 1 || to < from) {
    return NextResponse.json({ error: 'Invalid range: from must be ≥ 1 and ≤ to' }, { status: 400 })
  }
  if (to - from > 999) {
    return NextResponse.json({ error: 'Range too large (max 1000 rows)' }, { status: 400 })
  }

  const where   = buildWhere({
    platform:      platform      ?? null,
    search:        search        ?? '',
    tag:           tag           ?? null,
    contactStatus: statusFilter  ?? null,
    category:      category      ?? 'semua',
  })
  const orderBy = buildOrderBy(category ?? 'semua')

  // Resolve which customer IDs fall in rows [from, to] under the current filters+sort
  const customers = await prisma.customer.findMany({
    where,
    orderBy,
    skip:   from - 1,
    take:   to - from + 1,
    select: { id: true },
  })

  const ids = customers.map((c) => c.id)
  if (ids.length === 0) return NextResponse.json({ updated: 0 })

  const userId = (session.user as { id?: string }).id
  const now    = new Date()

  // Check which IDs already have a followUp record
  const existing = await prisma.followUp.findMany({
    where:  { customerId: { in: ids } },
    select: { customerId: true },
  })
  const existingSet = new Set(existing.map((f) => f.customerId))
  const newIds      = ids.filter((id) => !existingSet.has(id))

  const [updatedResult] = await Promise.all([
    prisma.followUp.updateMany({
      where: { customerId: { in: ids.filter((id) => existingSet.has(id)) } },
      data:  { contactStatus, followedUpById: userId, followedUpAt: now },
    }),
    newIds.length > 0
      ? prisma.followUp.createMany({
          data: newIds.map((customerId) => ({
            customerId, contactStatus, followedUpById: userId, followedUpAt: now,
          })),
        })
      : Promise.resolve(),
  ])

  return NextResponse.json({ updated: (updatedResult?.count ?? 0) + newIds.length })
}
