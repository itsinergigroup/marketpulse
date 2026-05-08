import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Platform } from '@prisma/client'

// DELETE /api/import/clear  body: { platform: 'shopee'|'tiktok', confirm: true }
// Deletes ALL orders, customers, follow-ups, and import history for the given platform.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'admin')
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })

  let body: { platform?: Platform; confirm?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { platform, confirm } = body

  if (!platform || !['shopee', 'tiktok'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  if (!confirm) {
    return NextResponse.json({ error: 'confirm: true required' }, { status: 400 })
  }

  console.log(`[import/clear] DELETE requested — platform: ${platform}`)

  try {
    // Resolve customer IDs for this platform so we can delete FollowUp records,
    // which have no platform field but carry a FK → Customer (no cascade in schema).
    const platformCustomers = await prisma.customer.findMany({
      where:  { platform },
      select: { id: true },
    })
    const customerIds = platformCustomers.map((c) => c.id)
    console.log(`[import/clear] found ${customerIds.length} customers for platform ${platform}`)

    // Delete in dependency order: followUps → orders → customers → import history
    const [deletedFollowUps, deletedOrders, deletedCustomers] = await prisma.$transaction([
      prisma.followUp.deleteMany({ where: { customerId: { in: customerIds } } }),
      prisma.order.deleteMany({ where: { platform } }),
      prisma.customer.deleteMany({ where: { platform } }),
    ])

    console.log(
      `[import/clear] deleted — followUps: ${deletedFollowUps.count}, orders: ${deletedOrders.count}, customers: ${deletedCustomers.count}`,
    )

    await prisma.importHistory.deleteMany({ where: { platform } })
    console.log(`[import/clear] import history cleared for platform ${platform}`)

    return NextResponse.json({
      success:          true,
      deletedFollowUps: deletedFollowUps.count,
      deletedOrders:    deletedOrders.count,
      deletedCustomers: deletedCustomers.count,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[import/clear] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
