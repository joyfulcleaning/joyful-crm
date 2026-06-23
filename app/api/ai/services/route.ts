export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'
import { normalizePhone } from '@/lib/phone'
import { HOURLY_SLOTS } from '@/lib/scheduling'
import { calcPrices, calcPrivatePrices, PRIVATE_CUSTOMER_NAME } from '@/lib/pricing'
import { stripPriceFields } from '@/lib/serviceVisibility'

// POST /api/ai/services
// Books a real cleaning service from a phone call. If the caller isn't an
// existing client, a new Client is created with price 0 (the owner fills it
// in later) — pricing for known clients reuses the same lookup the dashboard
// ServiceModal uses, so there's a single source of truth for prices.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      clientId, clientName, clientPhone, clientEmail,
      address, city, state, zip,
      type, roomSize, frequency,
      serviceDate, serviceTime, notes,
    } = body

    if (!address || !type || !serviceDate || !serviceTime) {
      return NextResponse.json({ error: 'address, type, serviceDate and serviceTime are required' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return NextResponse.json({ error: 'serviceDate must be YYYY-MM-DD' }, { status: 400 })
    }
    if (!HOURLY_SLOTS.includes(serviceTime)) {
      return NextResponse.json({ error: `serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}` }, { status: 400 })
    }

    const freq = frequency || 'one_time'

    // ── Resolve the client ──────────────────────────────────────────
    let client = clientId
      ? await prisma.client.findUnique({ where: { id: clientId }, include: { management: true } })
      : null

    if (!client && clientPhone) {
      const target = normalizePhone(clientPhone)
      const candidates = await prisma.client.findMany({
        where: { phone: { not: null } },
        include: { management: true },
      })
      client = candidates.find(c => c.phone && normalizePhone(c.phone) === target) || null
    }

    let isNewClient = false
    if (!client) {
      if (!clientName || !clientPhone) {
        return NextResponse.json({ error: 'clientName and clientPhone are required to create a new client' }, { status: 400 })
      }
      const privateMgmt = await prisma.management.findUnique({ where: { name: PRIVATE_CUSTOMER_NAME } })
      client = await prisma.client.create({
        data: {
          name: clientName,
          phone: clientPhone,
          email: clientEmail || null,
          address, city: city || undefined, state: state || undefined, zip: zip || null,
          managementId: privateMgmt?.id ?? null,
        },
        include: { management: true },
      })
      isNewClient = true
    }

    // ── Resolve price ────────────────────────────────────────────────
    let basePrice = 0
    let additionalFee = 0
    if (!isNewClient) {
      const priced = client.management?.name === PRIVATE_CUSTOMER_NAME
        ? calcPrivatePrices(client, freq)
        : calcPrices(client, type, roomSize)
      if (priced) {
        basePrice = priced.base
        additionalFee = priced.fee
      }
    }

    // ── Check availability ──────────────────────────────────────────
    const conflict = await prisma.service.findFirst({
      where: {
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        serviceTime,
        status: { not: 'cancelled' },
      },
      select: { id: true },
    })
    if (conflict) {
      return NextResponse.json({ error: 'Time slot already booked' }, { status: 409 })
    }

    const createdBy = await prisma.user.findFirst({ where: { role: 'admin' } })
    if (!createdBy) {
      return NextResponse.json({ error: 'No admin user found' }, { status: 500 })
    }

    const service = await prisma.service.create({
      data: {
        client: { connect: { id: client.id } },
        createdBy: { connect: { id: createdBy.id } },
        serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
        serviceTime,
        type,
        address,
        roomSize: roomSize || null,
        frequency: freq,
        basePrice,
        additionalFee,
        total: basePrice + additionalFee,
        internalNotes: notes ? `Scheduled by AI phone assistant. ${notes}` : 'Scheduled by AI phone assistant',
      },
    })

    return NextResponse.json({
      success: true,
      ...stripPriceFields(service),
      clientId: client.id,
      isNewClient,
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/ai/services:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
