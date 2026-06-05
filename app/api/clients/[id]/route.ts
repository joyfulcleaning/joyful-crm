import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const client = await prisma.client.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        phone: body.phone,
        email: body.email,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        propertyCode: body.propertyCode ?? null,
        frequency: body.frequency,
        status: body.status,
        managementId: body.managementId ?? null,
        priceRef: body.priceRef,
        notes: body.notes,
      },
      include: { management: true }
    })
    return NextResponse.json(client)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const client = await prisma.client.findUnique({
      where: { id }
    })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(client)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}