import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  void req

  const history = await prisma.importHistory.findMany({
    orderBy: { importedAt: 'desc' },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json({ history })
}
