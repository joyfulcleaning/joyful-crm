export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.service.findMany({
      where:   { roomSize: { not: null } },
      select:  { roomSize: true },
      distinct: ['roomSize'],
      orderBy: { roomSize: 'asc' },
    })
    const sizes = rows.map(r => r.roomSize).filter(Boolean) as string[]
    return NextResponse.json(sizes)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
