export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { asLang } from '@/lib/estimate-flow'

// Everything the visit screen in the app shows: contact, the linked
// estimate with its full client-flow history, and the service it became.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await context.params
    const visit = await prisma.estimateVisit.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        estimate: {
          include: {
            service: { select: { id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true, status: true } },
          },
        },
      },
    })
    if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(visit)
  } catch (error) {
    console.error('GET /api/estimate-visits/[id] error:', error)
    return NextResponse.json({ error: 'Failed to load estimate visit' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
    if (body.lang         !== undefined) data.lang         = asLang(body.lang)

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
    if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await context.params
    await prisma.estimateVisit.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/estimate-visits/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete estimate visit' }, { status: 500 })
  }
}
