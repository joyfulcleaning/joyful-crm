export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name        !== undefined) data.name        = body.name
    if (body.phone        !== undefined) data.phone        = body.phone || null
    if (body.email        !== undefined) data.email        = body.email || null
    if (body.address      !== undefined) data.address      = body.address || null
    if (body.visitDate    !== undefined) data.visitDate    = new Date(`${body.visitDate}T00:00:00.000Z`)
    if (body.visitTime    !== undefined) data.visitTime    = body.visitTime
    if (body.notes        !== undefined) data.notes        = body.notes || null
    if (body.status       !== undefined) data.status       = body.status
    if (body.clientId     !== undefined) data.clientId     = body.clientId || null

    const visit = await prisma.estimateVisit.update({
      where: { id },
      data,
      include: { client: { select: { id: true, name: true } } },
    })
    return NextResponse.json(visit)
  } catch (error) {
    console.error('PATCH /api/estimate-visits/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update estimate visit' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    await prisma.estimateVisit.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/estimate-visits/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete estimate visit' }, { status: 500 })
  }
}
