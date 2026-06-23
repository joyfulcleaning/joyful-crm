export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'
import { normalizePhone } from '@/lib/phone'
import { HOURLY_SLOTS } from '@/lib/scheduling'
import { stripPriceFields } from '@/lib/serviceVisibility'

// PATCH /api/ai/services/:id
// Reschedules and/or cancels a service. `callerPhone` is required and must
// match the owning client's phone/contactPhone — without this, the caller
// could cancel or move someone else's appointment just by guessing/asking
// for a serviceId.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const { callerPhone, serviceDate, serviceTime, status } = body

    if (!callerPhone) {
      return NextResponse.json({ error: 'callerPhone is required' }, { status: 400 })
    }
    if (!serviceDate && !serviceTime && !status) {
      return NextResponse.json({ error: 'Provide serviceDate/serviceTime to reschedule, or status to cancel' }, { status: 400 })
    }
    if (status && status !== 'cancelled') {
      return NextResponse.json({ error: 'status can only be set to cancelled' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: { client: { select: { phone: true, contactPhone: true } } },
    })
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const target = normalizePhone(callerPhone)
    const ownsService =
      (service.client.phone && normalizePhone(service.client.phone) === target) ||
      (service.client.contactPhone && normalizePhone(service.client.contactPhone) === target)
    if (!ownsService) {
      return NextResponse.json({ error: 'This service does not belong to the caller' }, { status: 403 })
    }

    const data: Record<string, unknown> = {}

    if (serviceDate || serviceTime) {
      const newDate = serviceDate || service.serviceDate.toISOString().slice(0, 10)
      const newTime = serviceTime || service.serviceTime
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return NextResponse.json({ error: 'serviceDate must be YYYY-MM-DD' }, { status: 400 })
      }
      if (!HOURLY_SLOTS.includes(newTime)) {
        return NextResponse.json({ error: `serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}` }, { status: 400 })
      }
      const conflict = await prisma.service.findFirst({
        where: {
          id: { not: id },
          serviceDate: new Date(`${newDate}T00:00:00.000Z`),
          serviceTime: newTime,
          status: { not: 'cancelled' },
        },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json({ error: 'Time slot already booked' }, { status: 409 })
      }
      data.serviceDate = new Date(`${newDate}T00:00:00.000Z`)
      data.serviceTime = newTime
    }

    if (status === 'cancelled') {
      data.status = 'cancelled'
    }

    const updated = await prisma.service.update({ where: { id }, data })

    return NextResponse.json({ success: true, ...stripPriceFields(updated) })
  } catch (error) {
    console.error('Error in PATCH /api/ai/services/[id]:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}
