export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const managements = await prisma.management.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { clients: true } } }
    })
    return NextResponse.json(managements)
  } catch (error) {
    console.error('GET /api/management:', error)
    return NextResponse.json({ error: 'Failed to load managements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const management = await prisma.management.create({
      data: {
        name: body.name,
        priceConditions: body.priceConditions ?? {},
        notes: body.notes,
      }
    })
    return NextResponse.json(management)
  } catch {
    return NextResponse.json({ error: 'Failed to create management' }, { status: 500 })
  }
}
