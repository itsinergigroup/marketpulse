import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContactStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ids, contactStatus } = body as { ids: string[]; contactStatus: ContactStatus }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }
  if (!contactStatus) {
    return NextResponse.json({ error: 'contactStatus required' }, { status: 400 })
  }

  const userId    = (session.user as { id?: string }).id
  const now       = new Date()

  // Update records that already have a followUp entry
  const updated = await prisma.followUp.updateMany({
    where: { customerId: { in: ids } },
    data:  { contactStatus, followedUpById: userId, followedUpAt: now },
  })

  // Create records for customers that don't have one yet
  const existing = await prisma.followUp.findMany({
    where:  { customerId: { in: ids } },
    select: { customerId: true },
  })
  const existingSet = new Set(existing.map((f) => f.customerId))
  const newIds      = ids.filter((id) => !existingSet.has(id))

  if (newIds.length > 0) {
    await prisma.followUp.createMany({
      data: newIds.map((customerId) => ({
        customerId,
        contactStatus,
        followedUpById: userId,
        followedUpAt:   now,
      })),
    })
  }

  return NextResponse.json({ updated: updated.count + newIds.length })
}
