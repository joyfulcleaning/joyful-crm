export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const management = await prisma.management.findUnique({
      where: { id },
      include: { clients: true }
    })
    if (!management) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(management)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch management' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const management = await prisma.management.update({
      where: { id },
      data: {
        name: body.name,
        priceConditions: body.priceConditions,
        notes: body.notes,
      }
    })
    return NextResponse.json(management)
  } catch {
    return NextResponse.json({ error: 'Failed to update management' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.management.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete management' }, { status: 500 })
  }
}
