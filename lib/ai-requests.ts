import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { HOURLY_SLOTS, isWorkingDay } from '@/lib/scheduling'
import { calcPrices, calcPrivatePrices, calcSqftEstimate, SQFT_RATES, PRIVATE_CUSTOMER_NAME } from '@/lib/pricing'
import {
  type HandlerResult, findServiceForCaller,
  createService, rescheduleOrCancelService, createSqftEstimate, scheduleEstimateVisit,
} from '@/lib/ai-handlers'

// Approval queue in front of the AI phone assistant's write actions. Instead
// of executing immediately, schedule_service/reschedule_or_cancel_service/
// create_sqft_estimate/schedule_estimate_visit land here as a pending
// AiRequest; resolveAiRequest() calls into the real, unmodified functions in
// lib/ai-handlers.ts once staff approves.

function prettyDate(iso?: string): string {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function prettyTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}:00 ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`
}

async function sendPlainEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: `"Joyful Cleaning Services Corp." <${process.env.GMAIL_USER}>`,
    to, subject, html,
  })
}

async function notifyAdmin(request: { id: string; type: string; summary: string; callerName: string | null; callerPhone: string | null; callerEmail: string | null }) {
  try {
    const [emailSetting, toggleSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'notif.email' } }),
      prisma.setting.findUnique({ where: { key: 'notif.aiRequest' } }),
    ])
    const adminEmail = emailSetting?.value
    if (!adminEmail || toggleSetting?.value === 'false') return

    await sendPlainEmail(
      adminEmail,
      `New AI request: ${request.summary}`,
      `<p>A caller's request needs your review.</p>
       <p><b>Type:</b> ${request.type}<br/>
       <b>From:</b> ${request.callerName || 'Unknown'} ${request.callerPhone || ''} ${request.callerEmail || ''}<br/>
       <b>Details:</b> ${request.summary}</p>
       <p><a href="https://joyful-crm.vercel.app/ai-requests">Review in the CRM</a></p>`
    )
  } catch (err) {
    console.error('Error notifying admin of AI request:', err)
  }
}

export async function requestService(args: {
  clientId?: string; clientName?: string; clientPhone?: string; clientEmail?: string
  address?: string; city?: string; state?: string; zip?: string; unit?: string
  type?: string; roomSize?: string; frequency?: string
  serviceDate?: string; serviceTime?: string; notes?: string
}, platform?: string): Promise<HandlerResult> {
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

  let client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId }, include: { management: true } })
    : null
  if (!client && clientPhone) {
    const target = normalizePhone(clientPhone)
    const candidates = await prisma.client.findMany({ where: { phone: { not: null } }, include: { management: true } })
    client = candidates.find(c => c.phone && normalizePhone(c.phone) === target) || null
  }
  if (!client && (!clientName || !clientPhone)) {
    return { status: 400, body: { error: 'clientName and clientPhone are required for a new customer' } }
  }

  const conflict = await prisma.service.findFirst({
    where: { serviceDate: new Date(`${serviceDate}T00:00:00.000Z`), serviceTime, status: { not: 'cancelled' } },
    select: { id: true },
  })
  if (conflict) return { status: 409, body: { error: 'Time slot already booked' } }

  let estimatedPrice: number | null = null
  if (client) {
    const freq = frequency || 'one_time'
    const priced = client.management?.name === PRIVATE_CUSTOMER_NAME
      ? calcPrivatePrices(client, freq)
      : calcPrices(client, type, roomSize || '')
    if (priced) estimatedPrice = priced.base + priced.fee
  }

  const summary = `We received a call from ${client?.name || clientName}. ` +
    (client
      ? `An existing customer in our system. `
      : `Not an existing customer in our system — we took down the information. `) +
    `Interested in a ${type} on ${prettyDate(serviceDate)} at ${prettyTime(serviceTime)}` +
    (address ? ` at ${address}` : '') +
    (frequency && frequency !== 'one_time' ? ` (${frequency})` : '') +
    `. All the details are recorded in this request.`

  const request = await prisma.aiRequest.create({
    data: {
      platform: platform || null,
      type: 'schedule_service',
      callerName: client?.name || clientName || null,
      callerPhone: client?.phone || clientPhone || null,
      callerEmail: client?.email || clientEmail || null,
      clientId: client?.id || null,
      summary,
      payload: { ...args, notes: notes || summary, isNewClient: !client, estimatedPrice } as any,
    },
  })
  await notifyAdmin(request)

  return { status: 200, body: { submitted: true, requestId: request.id } }
}

export async function requestRescheduleOrCancel(id: string, args: {
  callerPhone?: string; serviceDate?: string; serviceTime?: string; status?: string
}, platform?: string): Promise<HandlerResult> {
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

  let summary: string
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
    summary = `We received a call from ${service.client.name}, an existing customer. Requesting to ` +
      `reschedule the ${service.type} (currently ${prettyDate(service.serviceDate.toISOString().slice(0, 10))} at ${prettyTime(service.serviceTime)}) ` +
      `to ${prettyDate(newDate)} at ${prettyTime(newTime)}. All details are recorded in this request.`
  } else {
    summary = `We received a call from ${service.client.name}, an existing customer. Requesting to ` +
      `cancel the ${service.type} currently scheduled for ${prettyDate(service.serviceDate.toISOString().slice(0, 10))} at ${prettyTime(service.serviceTime)}. ` +
      `All details are recorded in this request.`
  }

  const request = await prisma.aiRequest.create({
    data: {
      platform: platform || null,
      type: 'reschedule_or_cancel_service',
      callerName: service.client.name,
      callerPhone,
      callerEmail: service.client.email,
      clientId: service.clientId,
      summary,
      payload: { serviceId: id, callerPhone, serviceDate, serviceTime, status } as any,
    },
  })
  await notifyAdmin(request)

  return { status: 200, body: { submitted: true, requestId: request.id } }
}

export async function requestSqftEstimate(args: {
  name?: string; phone?: string; email?: string; address?: string; sqft?: number; type?: string; notes?: string; clientId?: string
}, platform?: string): Promise<HandlerResult> {
  const { name, phone, email, address, sqft, type, notes, clientId } = args
  if (!name || !email || !address || !sqft || !type) {
    return { status: 400, body: { error: 'name, email, address, sqft and type are required' } }
  }
  const total = calcSqftEstimate(type, Number(sqft))
  if (total == null) {
    return { status: 400, body: { error: `type must be one of: ${Object.keys(SQFT_RATES).join(', ')}` } }
  }

  const summary = `We received a call from ${name}. Requesting an estimate for a ${type} cleaning, ` +
    `approximately ${sqft} sqft, at ${address}. Estimated price: $${total} (for your reference, never quoted to the caller). ` +
    `All details are recorded in this request.`

  const request = await prisma.aiRequest.create({
    data: {
      platform: platform || null,
      type: 'create_sqft_estimate',
      callerName: name,
      callerPhone: phone || null,
      callerEmail: email,
      clientId: clientId || null,
      summary,
      // NOTE: do not default `notes` to the narrative summary here — Estimate.notes
      // is client-facing (rendered on the PDF emailed to the customer), unlike
      // Service.internalNotes/EstimateVisit.notes which are staff-only.
      payload: { ...args, estimatedPrice: total } as any,
    },
  })
  await notifyAdmin(request)

  return { status: 200, body: { submitted: true, requestId: request.id } }
}

export async function requestEstimateVisit(args: {
  clientId?: string; name?: string; phone?: string; email?: string; address?: string
  city?: string; state?: string; zip?: string
  visitDate?: string; visitTime?: string; notes?: string
}, platform?: string): Promise<HandlerResult> {
  const { clientId, name, phone, email, address, visitDate, visitTime, notes } = args
  if (!name || !visitDate || !visitTime) {
    return { status: 400, body: { error: 'name, visitDate and visitTime are required' } }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    return { status: 400, body: { error: 'visitDate must be YYYY-MM-DD' } }
  }

  const summary = `We received a call from ${name}. Requesting an in-person visit to ` +
    `${address || 'the property'} to provide a quote, on ${prettyDate(visitDate)} at ${prettyTime(visitTime)}. ` +
    `All details are recorded in this request.`

  const request = await prisma.aiRequest.create({
    data: {
      platform: platform || null,
      type: 'schedule_estimate_visit',
      callerName: name,
      callerPhone: phone || null,
      callerEmail: email || null,
      clientId: clientId || null,
      summary,
      payload: { ...args, notes: notes || summary } as any,
    },
  })
  await notifyAdmin(request)

  return { status: 200, body: { submitted: true, requestId: request.id } }
}

export async function resolveAiRequest(id: string, args: {
  action?: string; adminNotes?: string; customerMessage?: string; notifyCustomer?: boolean; editedPayload?: Record<string, any>
}, resolvedById: string): Promise<HandlerResult> {
  const { action, adminNotes, customerMessage, notifyCustomer, editedPayload } = args
  if (action !== 'approve' && action !== 'reject') {
    return { status: 400, body: { error: 'action must be approve or reject' } }
  }

  const request = await prisma.aiRequest.findUnique({ where: { id } })
  if (!request) return { status: 404, body: { error: 'Not found' } }
  if (request.status !== 'pending') return { status: 409, body: { error: 'This request was already resolved' } }

  let resultServiceId: string | null = null
  let resultEstimateId: string | null = null
  let resultEstimateVisitId: string | null = null

  // Staff can tweak fields (date, time, address, type...) in the approval
  // modal before approving — whatever they end up with is what actually
  // gets booked, and it's what we persist back onto the request for the
  // record.
  const payload = { ...(request.payload as any), ...(editedPayload || {}) }

  if (action === 'approve') {
    let result: HandlerResult
    switch (request.type) {
      case 'schedule_service':
        result = await createService(payload)
        if (result.status >= 400) return result
        resultServiceId = result.body.id
        break
      case 'reschedule_or_cancel_service':
        result = await rescheduleOrCancelService(payload.serviceId, payload)
        if (result.status >= 400) return result
        resultServiceId = payload.serviceId
        break
      case 'create_sqft_estimate':
        result = await createSqftEstimate(payload)
        if (result.status >= 400) return result
        resultEstimateId = result.body.estimateId
        break
      case 'schedule_estimate_visit':
        result = await scheduleEstimateVisit(payload)
        if (result.status >= 400) return result
        resultEstimateVisitId = result.body.visitId
        break
      default:
        return { status: 400, body: { error: `Unknown request type: ${request.type}` } }
    }
  }

  const updated = await prisma.aiRequest.update({
    where: { id },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      adminNotes: adminNotes || null,
      customerMessage: customerMessage || null,
      payload,
      resolvedAt: new Date(),
      resolvedById,
      resultServiceId, resultEstimateId, resultEstimateVisitId,
    },
  })

  // create_sqft_estimate already emails the customer its own PDF — skip the
  // generic note for that type to avoid sending two emails.
  if (notifyCustomer && request.callerEmail && request.type !== 'create_sqft_estimate' && customerMessage) {
    try {
      await sendPlainEmail(
        request.callerEmail,
        action === 'approve' ? 'Your request has been confirmed — Joyful Cleaning Services Corp.' : 'About your request — Joyful Cleaning Services Corp.',
        `<p>${customerMessage.replace(/\n/g, '<br/>')}</p>`
      )
    } catch (err) {
      console.error('Error sending customer notification email:', err)
    }
  }

  return { status: 200, body: updated }
}
