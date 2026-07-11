export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { notifyEvent } from '@/lib/notify-admin'

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

    notifyEvent('newClient', {
      pushTitle: 'New client registered',
      pushBody:  `${client.name} (${client.type}) — added by ${authUser.name}`,
      pushData:  { type: 'newClient', clientId: client.id },
      emailSubject: `New client registered — ${client.name}`,
      emailHtml: `
        <p>A new client was added to the system.</p>
        <ul>
          <li><strong>Name:</strong> ${client.name}</li>
          <li><strong>Type:</strong> ${client.type}</li>
          <li><strong>Address:</strong> ${client.address ?? '—'}${client.city ? `, ${client.city}` : ''}</li>
          <li><strong>Added by:</strong> ${authUser.name}</li>
        </ul>
      `,
    }).catch(err => console.error('Error notifying new client:', err))

    return NextResponse.json(client)
  } catch {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
