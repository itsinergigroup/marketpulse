import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as { role?: string }).role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id }         = await params
    const { newPassword } = await req.json()

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id }, data: { password: hashed } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[reset-password PUT]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
