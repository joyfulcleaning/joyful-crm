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

    const paymentTermsDays   = body.paymentTermsDays != null && body.paymentTermsDays !== '' ? Number(body.paymentTermsDays) : null
    const defaultTaxRate     = body.defaultTaxRate != null && body.defaultTaxRate !== '' ? Number(body.defaultTaxRate) : null
    const defaultPaymentMethod = body.defaultPaymentMethod || null

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        type: body.type ?? undefined,
        phone: body.phone || null,
        email: body.email || null,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        propertyCode: body.propertyCode || null,
        frequency: body.frequency || undefined,
        status: body.status || 'active',
        managementId: body.managementId || null,
        priceRef: body.priceRef ?? undefined,
        notes: body.notes || null,
        paymentTermsDays,
        defaultTaxRate,
        defaultPaymentMethod,
      },
      include: { management: true }
    })

    return NextResponse.json(client)
  } catch (error) {
    console.error('[PATCH /api/clients/:id] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(client)
  } catch (error) {
    console.error('[GET /api/clients/:id] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}
