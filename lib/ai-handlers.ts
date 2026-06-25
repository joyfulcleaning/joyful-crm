import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { HOURLY_SLOTS, nowInEastern, isWorkingDay } from '@/lib/scheduling'
import { calcPrices, calcPrivatePrices, calcSqftEstimate, SQFT_RATES, PRIVATE_CUSTOMER_NAME } from '@/lib/pricing'
import { stripPriceFields } from '@/lib/serviceVisibility'
import { generateEstimatePDF, buildEmailHtml, type EstimateData } from '@/lib/estimate-pdf'

// Shared business logic for the /api/ai/* namespace, called directly both by
// the REST routes (for manual/direct testing) and by the Vapi webhook (so a
// live call never pays for an extra HTTP self-call hop).
export type HandlerResult = { status: number; body: any }

export async function findClientByPhone(phone: string | null): Promise<HandlerResult> {
  if (!phone) return { status: 400, body: { error: 'phone query param is required' } }

  const target = normalizePhone(phone)
  if (target.length < 7) return { status: 200, body: { found: false, clients: [] } }

  const candidates = await prisma.client.findMany({
    where: { OR: [{ phone: { not: null } }, { contactPhone: { not: null } }] },
    include: { management: { select: { name: true } } },
  })

  const matches = candidates.filter(c =>
    (c.phone && normalizePhone(c.phone) === target) ||
    (c.contactPhone && normalizePhone(c.contactPhone) === target)
  )

  const clients = matches.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    phone: c.phone,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    address: c.address,
    city: c.city,
    state: c.state,
    zip: c.zip,
    frequency: c.frequency,
    managementName: c.management?.name ?? null,
  }))

  return { status: 200, body: { found: clients.length > 0, clients } }
}

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Computed server-side rather than trusted from the model — LLMs are
// unreliable at both "what's today's date" and weekday math from memory.
export async function getCurrentDate(): Promise<HandlerResult> {
  const now = nowInEastern()
  const dayOfWeek = DAY_NAMES_ES[new Date(`${now.date}T12:00:00Z`).getUTCDay()]
  return { status: 200, body: { date: now.date, dayOfWeek } }
}

export async function checkAvailability(date: string | null): Promise<HandlerResult> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: 'date query param is required (YYYY-MM-DD)' } }
  }

  const dayOfWeek = DAY_NAMES_ES[new Date(`${date}T12:00:00Z`).getUTCDay()]

  if (!isWorkingDay(date)) {
    return { status: 200, body: { date, dayOfWeek, closed: true, slots: [], availableTimes: [] } }
  }

  const services = await prisma.service.findMany({
    where: { serviceDate: new Date(`${date}T00:00:00.000Z`), status: { not: 'cancelled' } },
    select: { serviceTime: true },
  })
  const taken = new Set(services.map(s => s.serviceTime))

  const now = nowInEastern()
  const isToday = date === now.date

  const slots = HOURLY_SLOTS
    .filter(time => !isToday || Number(time.slice(0, 2)) > now.hour)
    .map(time => ({ time, available: !taken.has(time) }))

  return {
    status: 200,
    body: { date, dayOfWeek, slots, availableTimes: slots.filter(s => s.available).map(s => s.time) },
  }
}

export async function listClientServices(clientId: string | null, phone: string | null): Promise<HandlerResult> {
  if (!clientId && !phone) {
    return { status: 400, body: { error: 'clientId or phone query param is required' } }
  }

  let resolvedClientId = clientId
  if (!resolvedClientId && phone) {
    const target = normalizePhone(phone)
    const candidates = await prisma.client.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })
    resolvedClientId = candidates.find(c => c.phone && normalizePhone(c.phone) === target)?.id ?? null
  }

  if (!resolvedClientId) return { status: 200, body: { found: false, services: [] } }

  const services = await prisma.service.findMany({
    where: { clientId: resolvedClientId },
    select: { id: true, serviceDate: true, serviceTime: true, type: true, address: true, status: true, frequency: true },
    orderBy: { serviceDate: 'asc' },
  })

  return { status: 200, body: { found: true, services } }
}

export async function createService(args: {
  clientId?: string; clientName?: string; clientPhone?: string; clientEmail?: string
  address?: string; city?: string; state?: string; zip?: string
  type?: string; roomSize?: string; frequency?: string
  serviceDate?: string; serviceTime?: string; notes?: string
}): Promise<HandlerResult> {
  const { clientId, clientName, clientPhone, clientEmail, address, city, state, zip, type, roomSize, frequency, serviceDate, serviceTime, notes } = args

  if (!address || !type || !serviceDate || !serviceTime) {
    return { status: 400, body: { error: 'address, type, serviceDate and serviceTime are required' } }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return { status: 400, body: { error: 'serviceDate must be YYYY-MM-DD' } }
  }
  if (!isWorkingDay(serviceDate)) {
    return { status: 400, body: { error: 'We are closed that day. We work Monday through Friday.' } }
  }
  if (!HOURLY_SLOTS.includes(serviceTime)) {
    return { status: 400, body: { error: `serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}` } }
  }

  const freq = frequency || 'one_time'

  let client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId }, include: { management: true } })
    : null

  if (!client && clientPhone) {
    const target = normalizePhone(clientPhone)
    const candidates = await prisma.client.findMany({ where: { phone: { not: null } }, include: { management: true } })
    client = candidates.find(c => c.phone && normalizePhone(c.phone) === target) || null
  }

  let isNewClient = false
  if (!client) {
    if (!clientName || !clientPhone) {
      return { status: 400, body: { error: 'clientName and clientPhone are required to create a new client' } }
    }
    const privateMgmt = await prisma.management.findUnique({ where: { name: PRIVATE_CUSTOMER_NAME } })
    client = await prisma.client.create({
      data: {
        name: clientName,
        phone: clientPhone,
        email: clientEmail || null,
        address, city: city || undefined, state: state || undefined, zip: zip || null,
        managementId: privateMgmt?.id ?? null,
        notes: 'Created by AI phone assistant',
      },
      include: { management: true },
    })
    isNewClient = true
  }

  let basePrice = 0
  let additionalFee = 0
  if (!isNewClient) {
    const priced = client.management?.name === PRIVATE_CUSTOMER_NAME
      ? calcPrivatePrices(client, freq)
      : calcPrices(client, type, roomSize || '')
    if (priced) {
      basePrice = priced.base
      additionalFee = priced.fee
    }
  }

  const conflict = await prisma.service.findFirst({
    where: { serviceDate: new Date(`${serviceDate}T00:00:00.000Z`), serviceTime, status: { not: 'cancelled' } },
    select: { id: true },
  })
  if (conflict) return { status: 409, body: { error: 'Time slot already booked' } }

  const createdBy = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!createdBy) return { status: 500, body: { error: 'No admin user found' } }

  const service = await prisma.service.create({
    data: {
      client: { connect: { id: client.id } },
      createdBy: { connect: { id: createdBy.id } },
      serviceDate: new Date(`${serviceDate}T00:00:00.000Z`),
      serviceTime,
      type,
      address,
      roomSize: roomSize || null,
      frequency: freq as any,
      basePrice,
      additionalFee,
      total: basePrice + additionalFee,
      internalNotes: notes ? `Scheduled by AI phone assistant. ${notes}` : 'Scheduled by AI phone assistant',
    },
  })

  return {
    status: 201,
    body: {
      success: true, ...stripPriceFields(service), clientId: client.id, isNewClient,
      dayOfWeek: DAY_NAMES_ES[new Date(`${serviceDate}T12:00:00Z`).getUTCDay()],
    },
  }
}

// Shared by rescheduleOrCancelService (live execution) and
// requestRescheduleOrCancel (lib/ai-requests.ts, submits for approval) so the
// ownership check (and the client data needed for the approval summary)
// only lives in one place.
export async function findServiceForCaller(id: string, callerPhone: string): Promise<
  { service: any } | { status: number; error: string }
> {
  const service = await prisma.service.findUnique({ where: { id }, include: { client: true } })
  if (!service) return { status: 404, error: 'Not found' }

  const target = normalizePhone(callerPhone)
  const ownsService =
    (service.client.phone && normalizePhone(service.client.phone) === target) ||
    (service.client.contactPhone && normalizePhone(service.client.contactPhone) === target)
  if (!ownsService) return { status: 403, error: 'This service does not belong to the caller' }

  return { service }
}

export async function rescheduleOrCancelService(id: string, args: {
  callerPhone?: string; serviceDate?: string; serviceTime?: string; status?: string
}): Promise<HandlerResult> {
  const { callerPhone, serviceDate, serviceTime, status } = args

  if (!callerPhone) return { status: 400, body: { error: 'callerPhone is required' } }
  if (!serviceDate && !serviceTime && !status) {
    return { status: 400, body: { error: 'Provide serviceDate/serviceTime to reschedule, or status to cancel' } }
  }
  if (status && status !== 'cancelled') {
    return { status: 400, body: { error: 'status can only be set to cancelled' } }
  }

  const found = await findServiceForCaller(id, callerPhone)
  if ('error' in found) return { status: found.status, body: { error: found.error } }
  const { service } = found

  const data: Record<string, unknown> = {}
  const actionNotes: string[] = []

  if (serviceDate || serviceTime) {
    const newDate = serviceDate || service.serviceDate.toISOString().slice(0, 10)
    const newTime = serviceTime || service.serviceTime
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return { status: 400, body: { error: 'serviceDate must be YYYY-MM-DD' } }
    }
    if (!isWorkingDay(newDate)) {
      return { status: 400, body: { error: 'We are closed that day. We work Monday through Friday.' } }
    }
    if (!HOURLY_SLOTS.includes(newTime)) {
      return { status: 400, body: { error: `serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}` } }
    }
    const conflict = await prisma.service.findFirst({
      where: { id: { not: id }, serviceDate: new Date(`${newDate}T00:00:00.000Z`), serviceTime: newTime, status: { not: 'cancelled' } },
      select: { id: true },
    })
    if (conflict) return { status: 409, body: { error: 'Time slot already booked' } }
    data.serviceDate = new Date(`${newDate}T00:00:00.000Z`)
    data.serviceTime = newTime
    actionNotes.push(`Rescheduled by AI phone assistant to ${newDate} ${newTime}.`)
  }

  if (status === 'cancelled') {
    data.status = 'cancelled'
    actionNotes.push('Cancelled by AI phone assistant.')
  }

  if (actionNotes.length > 0) {
    data.internalNotes = service.internalNotes
      ? `${service.internalNotes}\n${actionNotes.join(' ')}`
      : actionNotes.join(' ')
  }

  const updated = await prisma.service.update({ where: { id }, data })

  return {
    status: 200,
    body: {
      success: true, ...stripPriceFields(updated),
      dayOfWeek: DAY_NAMES_ES[updated.serviceDate.getUTCDay()],
    },
  }
}

export async function createSqftEstimate(args: {
  name?: string; phone?: string; email?: string; address?: string; sqft?: number; type?: string; notes?: string; clientId?: string
}): Promise<HandlerResult> {
  const { name, phone, email, address, sqft, type, notes, clientId } = args

  if (!name || !email || !address || !sqft || !type) {
    return { status: 400, body: { error: 'name, email, address, sqft and type are required' } }
  }
  const total = calcSqftEstimate(type, Number(sqft))
  if (total == null) {
    return { status: 400, body: { error: `type must be one of: ${Object.keys(SQFT_RATES).join(', ')}` } }
  }

  let resolvedClientId: string | null = clientId || null
  if (!resolvedClientId && phone) {
    const target = normalizePhone(phone)
    const candidates = await prisma.client.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })
    resolvedClientId = candidates.find(c => c.phone && normalizePhone(c.phone) === target)?.id ?? null
  }

  const year = new Date().getFullYear()
  const count = await prisma.estimate.count()
  const estimateNumber = `EST-${year}-${String(count + 1).padStart(3, '0')}`

  const issueDate = new Date()
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const estimateData: EstimateData = {
    estimateNumber,
    issueDate: issueDate.toISOString(),
    validUntil: validUntil.toISOString(),
    clientName: name,
    clientEmail: email,
    clientPhone: phone || '',
    clientAddress: address,
    notes: notes || '',
    taxRate: 0,
    items: [{ description: `${type} — ${sqft} sqft`, qty: 1, unitPrice: total, total }],
    subtotal: total,
    tax: 0,
    total,
  }

  let estimate
  try {
    estimate = await prisma.estimate.create({
      data: {
        estimateNumber, issueDate, validUntil,
        clientName: name, clientEmail: email, clientPhone: phone || null, clientAddress: address,
        notes: notes || null, internalNotes: 'Created by AI phone assistant',
        taxRate: 0, subtotal: total, tax: 0, total,
        items: estimateData.items, clientId: resolvedClientId,
      },
    })
  } catch (error: any) {
    if (error.code === 'P2002') return { status: 409, body: { error: 'Estimate number already exists, try again' } }
    throw error
  }

  let emailSent = false
  try {
    const [pdfBuffer, emailHtml] = await Promise.all([
      generateEstimatePDF(estimateData),
      Promise.resolve(buildEmailHtml(estimateData)),
    ])
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    await transporter.sendMail({
      from: `"Joyful Cleaning Services Corp." <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Estimate ${estimateNumber} | Joyful Cleaning Services Corp.`,
      html: emailHtml,
      attachments: [{ filename: `Estimate-${estimateNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    })
    emailSent = true
    await prisma.estimate.update({ where: { id: estimate.id }, data: { emailSentAt: new Date() } })
  } catch (emailError) {
    console.error('Error sending AI estimate email:', emailError)
  }

  return { status: 201, body: { success: true, estimateId: estimate.id, estimateNumber, emailSent } }
}

export async function scheduleEstimateVisit(args: {
  clientId?: string; name?: string; phone?: string; email?: string; address?: string
  visitDate?: string; visitTime?: string; notes?: string
}): Promise<HandlerResult> {
  const { clientId, name, phone, email, address, visitDate, visitTime, notes } = args

  if (!name || !visitDate || !visitTime) {
    return { status: 400, body: { error: 'name, visitDate and visitTime are required' } }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    return { status: 400, body: { error: 'visitDate must be YYYY-MM-DD' } }
  }

  const visit = await prisma.estimateVisit.create({
    data: {
      clientId: clientId || null,
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      visitDate: new Date(`${visitDate}T00:00:00.000Z`),
      visitTime,
      notes: notes ? `Created by AI phone assistant. ${notes}` : 'Created by AI phone assistant',
    },
  })

  return {
    status: 201,
    body: { success: true, visitId: visit.id, clientId: visit.clientId, visitDate, visitTime, address: visit.address },
  }
}
