import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as { role?: string }).role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id }          = await params
    const { name, email } = await req.json()

    if (!name && !email) {
      return NextResponse.json({ error: 'name or email required' }, { status: 400 })
    }

    // Check email uniqueness if changing email
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } })
      if (existing) return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
    }

    const user = await prisma.user.update({
      where:  { id },
      data:   { ...(name && { name }), ...(email && { email }) },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({ user })
  } catch (e) {
    console.error('[users PUT]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  void req
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as { role?: string }).role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id }    = await params
    const selfId    = (session.user as { id?: string }).id
    if (id === selfId) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[users DELETE]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
