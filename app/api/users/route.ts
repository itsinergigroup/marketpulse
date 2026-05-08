import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireAdmin(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session?.user?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  void req
  try {
    const session = await getServerSession(authOptions)
    const err = requireAdmin(session)
    if (err) return err

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ users })
  } catch (e) {
    console.error('[users GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const err = requireAdmin(session)
    if (err) return err

    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'name, email, password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email sudah digunakan' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data:   { name, email, password: hashed, role: 'staff' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    console.error('[users POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
