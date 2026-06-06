export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
