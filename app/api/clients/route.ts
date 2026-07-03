export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: { management: true }
    })

    // Fetch billing defaults for all clients via raw SQL
    // Use per-UUID placeholders — Prisma's raw query doesn't reliably handle JS arrays via $1::uuid[]
    const ids = clients.map((c: any) => c.id)
    let defaults: any[] = []
    if (ids.length > 0) {
      // id is TEXT in PostgreSQL (Prisma String → text), no ::uuid cast needed
      const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(', ')
      defaults = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "paymentTermsDays", "defaultTaxRate", "defaultPaymentMethod" FROM clients WHERE id IN (${placeholders})`,
        ...ids
      ).catch((e: any) => { console.error('[GET /api/clients] billing defaults query failed:', e); return [] })
    }
    const defaultsMap = new Map(defaults.map((d: any) => [d.id, d]))

    return NextResponse.json(clients.map((c: any) => ({
      ...c,
      ...(defaultsMap.get(c.id) || {}),
    })))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Create client with known fields only
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

    // Set billing defaults via raw SQL
    const paymentTermsDays = body.paymentTermsDays != null && body.paymentTermsDays !== '' ? Number(body.paymentTermsDays) : null
    const defaultTaxRate   = body.defaultTaxRate != null && body.defaultTaxRate !== '' ? Number(body.defaultTaxRate) : null
    const defaultPaymentMethod = body.defaultPaymentMethod || null

    if (paymentTermsDays !== null || defaultTaxRate !== null || defaultPaymentMethod !== null) {
      await prisma.$executeRawUnsafe(
        `UPDATE clients SET "paymentTermsDays" = $1, "defaultTaxRate" = $2, "defaultPaymentMethod" = $3 WHERE id = $4::uuid`,
        paymentTermsDays,
        defaultTaxRate,
        defaultPaymentMethod,
        client.id
      ).catch(() => {})
    }

    return NextResponse.json({
      ...client,
      paymentTermsDays,
      defaultTaxRate,
      defaultPaymentMethod,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
