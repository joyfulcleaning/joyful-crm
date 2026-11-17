export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { sendPlainEmail } from '@/lib/email'
import { appendEvent, asLang, ensurePublicToken, estimateLink } from '@/lib/estimate-flow'
import { proposalEmail } from '@/lib/estimate-emails'

// POST /api/estimates/[id]/flow  { action, ... }
//
// The team's side of the estimate after it went out:
//   propose       { date, time, note?, via }  offer the client a different day
//   mark_accepted                             the client accepted by phone
//   reopen                                    undo a response so the client can answer again
//   set_client    { clientId }                link the estimate and its visit to a CRM client
//   link_service  { serviceId }               admin only: the service booked from it
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return fail('Unauthorized', 401)

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const est = await prisma.estimate.findUnique({ where: { id } })
    if (!est) return fail('Not found', 404)
    const closed = est.status === 'service_created' || !!est.serviceId

    switch (body.action) {
      case 'propose': {
        if (est.response !== 'accepted') return fail('The client has not accepted this estimate.', 409)
        if (closed) return fail('A service was already booked from this estimate.', 409)
        const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null
        const time = typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null
        if (!date || !time) return fail('Pick a day and a time.')
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : ''
        const via = body.via === 'sms' ? 'sms' : 'email'
        if (via === 'email' && !est.clientEmail) return fail('This estimate has no email. Send it by text instead.')

        const lang = asLang(body.lang ?? est.lang)
        const token = await ensurePublicToken(est.id, est.publicToken)
        const msg = proposalEmail(lang, { clientName: est.clientName, estimateNumber: est.estimateNumber, date, time, note, link: estimateLink(token, req) })
        if (via === 'email') await sendPlainEmail(est.clientEmail!, msg.subject, msg.html)

        const updated = await prisma.estimate.update({
          where: { id },
          data: {
            schedulingPending: 'client', agreedDate: null, agreedTime: null,
            events: appendEvent(est.events, { type: 'proposed', by: 'team', via, date, time, note: note || undefined, userName: authUser.name }),
          },
        })
        return NextResponse.json({ estimate: updated, sms: via === 'sms' ? msg.sms : undefined, phone: est.clientPhone })
      }

      case 'mark_accepted': {
        if (closed) return fail('A service was already booked from this estimate.', 409)
        if (est.response === 'accepted') return fail('Already accepted.', 409)
        const updated = await prisma.estimate.update({
          where: { id },
          data: {
            response: 'accepted', respondedAt: new Date(), responseNote: null, declineReason: null,
            schedulingPending: 'team', agreedDate: null, agreedTime: null,
            events: appendEvent(est.events, { type: 'accepted', by: 'team', via: 'phone', userName: authUser.name }),
          },
        })
        return NextResponse.json({ estimate: updated })
      }

      case 'reopen': {
        if (closed) return fail('A service was already booked from this estimate.', 409)
        const updated = await prisma.estimate.update({
          where: { id },
          data: {
            response: null, respondedAt: null, responseNote: null, declineReason: null,
            schedulingPending: null, agreedDate: null, agreedTime: null,
            events: appendEvent(est.events, { type: 'reopened', by: 'team', userName: authUser.name }),
          },
        })
        return NextResponse.json({ estimate: updated })
      }

      // The visit came from someone not yet in the CRM: once the app creates
      // the client (needed to book a service), point the estimate and its
      // visit at them.
      case 'set_client': {
        const clientId = typeof body.clientId === 'string' ? body.clientId : ''
        const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }) : null
        if (!client) return fail('Client not found', 404)
        const [updated] = await prisma.$transaction([
          prisma.estimate.update({ where: { id }, data: { clientId } }),
          prisma.estimateVisit.updateMany({ where: { estimateId: id }, data: { clientId } }),
        ])
        return NextResponse.json({ estimate: updated })
      }

      // Julio's rule: only an admin books the service an estimate turns into.
      case 'link_service': {
        if (authUser.role !== 'admin') return fail('Only an admin can schedule the service for an estimate.', 403)
        const serviceId = typeof body.serviceId === 'string' ? body.serviceId : ''
        const service = serviceId ? await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } }) : null
        if (!service) return fail('Service not found', 404)
        const [updated] = await prisma.$transaction([
          prisma.estimate.update({
            where: { id },
            data: {
              serviceId, status: 'service_created', schedulingPending: null,
              events: appendEvent(est.events, { type: 'service', by: 'team', userName: authUser.name }),
            },
          }),
          prisma.estimateVisit.updateMany({ where: { estimateId: id, status: 'scheduled' }, data: { status: 'completed' } }),
        ])
        return NextResponse.json({ estimate: updated })
      }

      default:
        return fail('Unknown action')
    }
  } catch (error) {
    console.error('POST /api/estimates/[id]/flow error:', error)
    return fail('Failed to update the estimate', 500)
  }
}
