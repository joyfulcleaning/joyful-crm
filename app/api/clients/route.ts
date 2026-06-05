export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: { management: true }
    })
    return NextResponse.json(clients)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const client = await prisma.client.create({
      data: {
        name: body.name,
        type: body.type,
        phone: body.phone,
        email: body.email,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        address: body.address,
        city: body.city || 'Fayetteville',
        state: body.state || 'NC',
        zip: body.zip,
        propertyCode: body.propertyCode || null,
        frequency: body.frequency,
        status: body.status || 'active',
        managementId: body.managementId || null,
        priceRef: body.priceRef,
        notes: body.notes,
      },
      include: { management: true }
    })
    return NextResponse.json(client)
  } catch {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}