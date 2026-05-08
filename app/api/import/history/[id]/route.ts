import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const record = await prisma.importHistory.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.importHistory.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[import/history] delete error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
