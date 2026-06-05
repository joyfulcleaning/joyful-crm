import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const managements = await prisma.management.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { clients: true } } }
    })
    return NextResponse.json(managements)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
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
