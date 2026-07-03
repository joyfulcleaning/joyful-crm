export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const paymentTermsDays   = body.paymentTermsDays != null && body.paymentTermsDays !== '' ? Number(body.paymentTermsDays) : null
    const defaultTaxRate     = body.defaultTaxRate != null && body.defaultTaxRate !== '' ? Number(body.defaultTaxRate) : null
    const defaultPaymentMethod = body.defaultPaymentMethod || null
    const managementId       = body.managementId || null
    // priceRef must be a JSON string for the ::jsonb cast
    const priceRefJson       = body.priceRef != null ? JSON.stringify(body.priceRef) : null

    // Single UPDATE covering all fields — bypasses old Prisma client's unknown-field validation.
    // Use direct casts only ($N::type); NULL::type is always NULL so no CASE needed for nullable fields.
    // id and managementId are TEXT columns in PostgreSQL (Prisma maps String to text, not uuid).
    // All other non-enum/non-special fields are also text — no ::uuid cast needed.
    await prisma.$executeRawUnsafe(
      `UPDATE clients SET
        name                   = $1,
        type                   = $2::"ClientType",
        phone                  = $3,
        email                  = $4,
        "contactName"          = $5,
        "contactPhone"         = $6,
        address                = $7,
        city                   = $8,
        state                  = $9,
        zip                    = $10,
        "propertyCode"         = $11,
        frequency              = $12::"Frequency",
        status                 = $13,
        "managementId"         = $14,
        "priceRef"             = $15::jsonb,
        notes                  = $16,
        "paymentTermsDays"     = $17::integer,
        "defaultTaxRate"       = $18::numeric,
        "defaultPaymentMethod" = $19::"PaymentMethod",
        "updatedAt"            = NOW()
      WHERE id = $20`,
      body.name           ?? null,
      body.type           ?? null,
      body.phone          || null,
      body.email          || null,
      body.contactName    || null,
      body.contactPhone   || null,
      body.address        || null,
      body.city           || null,
      body.state          || null,
      body.zip            || null,
      body.propertyCode   || null,
      body.frequency      || null,
      body.status         || 'active',
      managementId,
      priceRefJson,
      body.notes          || null,
      paymentTermsDays,
      defaultTaxRate,
      defaultPaymentMethod,
      id
    )

    // Read back the updated client with management relation
    const client = await prisma.client.findUnique({
      where: { id },
      include: { management: true }
    })

    return NextResponse.json({
      ...client,
      paymentTermsDays,
      defaultTaxRate,
      defaultPaymentMethod,
    })
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
    const { id } = await context.params
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "paymentTermsDays", "defaultTaxRate", "defaultPaymentMethod" FROM clients WHERE id = $1`,
      id
    ).catch(() => [{}])

    return NextResponse.json({ ...client, ...(rows[0] || {}) })
  } catch (error) {
    console.error('[GET /api/clients/:id] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}
