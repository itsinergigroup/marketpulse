import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// In-memory rate limiter: IP → { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS    = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= MAX_ATTEMPTS) return false

  entry.count++
  return true
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  console.log(`[emergency-reset] POST attempt from IP: ${ip}`)

  if (!checkRateLimit(ip)) {
    console.log(`[emergency-reset] Rate limit exceeded for IP: ${ip}`)
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Coba lagi dalam 1 jam.' },
      { status: 429 },
    )
  }

  const secret = process.env.EMERGENCY_RESET_TOKEN ?? ''
  if (secret.length < 32) {
    console.error('[emergency-reset] EMERGENCY_RESET_TOKEN not configured or too short (<32 chars)')
    return NextResponse.json({ error: 'Not configured on server' }, { status: 500 })
  }

  let body: { token?: unknown; userId?: unknown; newPassword?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, userId, newPassword } = body

  if (typeof token !== 'string' || token !== secret) {
    console.log(`[emergency-reset] Invalid token from IP: ${ip}`)
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (typeof userId !== 'string' || !userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })

  console.log(`[emergency-reset] SUCCESS — reset password for user: ${user.email} from IP: ${ip}`)
  return NextResponse.json({ ok: true })
}
