export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: { management: true }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('GET /api/clients:', error)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const paymentTermsDays = body.paymentTermsDays != null && body.paymentTermsDays !== '' ? Number(body.paymentTermsDays) : null
    const defaultTaxRate   = body.defaultTaxRate != null && body.defaultTaxRate !== '' ? Number(body.defaultTaxRate) : null
    const defaultPaymentMethod = body.defaultPaymentMethod || null

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
        paymentTermsDays,
        defaultTaxRate,
        defaultPaymentMethod,
      },
      include: { management: true }
    })

    logAudit(authUser, 'create', 'client', client.id, { name: client.name, type: client.type })

    return NextResponse.json(client)
  } catch {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
