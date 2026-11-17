export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { appendEvent, asWindow, isExpired, ymd, DECLINE_REASONS, FlowEvent } from '@/lib/estimate-flow'
import { notifyEstimateAction } from '@/lib/estimate-notify'
import { nowInEastern } from '@/lib/scheduling'

// Public, unauthenticated: what the client does from the /e/[token] page.
// The token is the only credential — 24 random url-safe characters, so it
// can't be guessed or derived from the estimate number. Each action checks
// the estimate is in a state where it makes sense, so replaying a request or
// pressing a stale button can't, for example, accept twice or undo a
// decline.

const MAX_NOTE = 2000

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

const note = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_NOTE) : '')

// A day the client may ask for: from tomorrow up to 120 days out.
function validDay(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const today = nowInEastern().date
  const max = new Date(`${today}T00:00:00Z`)
  max.setUTCDate(max.getUTCDate() + 120)
  return v > today && v <= ymd(max) ? v : null
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    if (!token || token.length < 16) return fail('Not found', 404)
    if (!checkRateLimit(`estimate-link:${token}:${clientIp(request)}`, 30)) return fail('Too many requests, try again in a few minutes.', 429)

    const est = await prisma.estimate.findUnique({
      where: { publicToken: token },
      include: { estimateVisits: { select: { id: true }, take: 1 } },
    })
    if (!est || est.status === 'cancelled') return fail('Not found', 404)

    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '')
    const visitId = est.estimateVisits[0]?.id ?? null
    const closed = est.status === 'service_created' || !!est.serviceId
    const expired = isExpired(est.validUntil)
    const events = est.events as FlowEvent[]

    switch (action) {
      // Sent from the page's script after it loads, not on the server render:
      // mail scanners that pre-fetch links don't run scripts, so they don't
      // mark an estimate as seen.
      case 'view': {
        if (!est.viewedAt) {
          await prisma.estimate.update({ where: { id: est.id }, data: { viewedAt: new Date(), events: appendEvent(events, { type: 'viewed', by: 'client' }) } })
        }
        return NextResponse.json({ ok: true })
      }

      case 'question': {
        const text = note(body.note)
        if (!text) return fail('Write your question first.')
        await prisma.estimate.update({ where: { id: est.id }, data: { events: appendEvent(events, { type: 'question', by: 'client', note: text }) } })
        await notifyEstimateAction(est, visitId, { kind: 'question', note: text })
        return NextResponse.json({ ok: true })
      }

      case 'accept':
      case 'changes':
      case 'decline': {
        if (closed) return fail('This estimate is already booked.', 409)
        if (est.response) return fail('You already answered this estimate.', 409)
        if (expired) return fail('This estimate has expired. Call us at (919) 322-9092 for an updated one.', 410)

        if (action === 'accept') {
          const date = validDay(body.date)
          const window = asWindow(body.window)
          if (!date || !window) return fail('Pick a day and a time of day.')
          if (body.agree !== true) return fail('Check the box to accept the estimate.')
          const text = note(body.note)
          await prisma.estimate.update({
            where: { id: est.id },
            data: {
              response: 'accepted', respondedAt: new Date(), responseNote: text || null,
              schedulingPending: 'team', agreedDate: null, agreedTime: null,
              events: appendEvent(events, { type: 'accepted', by: 'client', date, window, note: text || undefined }),
            },
          })
          await notifyEstimateAction(est, visitId, { kind: 'accepted', date, window, note: text })
        } else if (action === 'changes') {
          const text = note(body.note)
          if (!text) return fail('Tell us what you would like to change.')
          await prisma.estimate.update({
            where: { id: est.id },
            data: { response: 'changes', respondedAt: new Date(), responseNote: text, events: appendEvent(events, { type: 'changes', by: 'client', note: text }) },
          })
          await notifyEstimateAction(est, visitId, { kind: 'changes', note: text })
        } else {
          const reason = typeof body.reason === 'string' && body.reason in DECLINE_REASONS.en ? body.reason : null
          const text = note(body.note)
          await prisma.estimate.update({
            where: { id: est.id },
            data: {
              response: 'declined', respondedAt: new Date(), declineReason: reason, responseNote: text || null,
              events: appendEvent(events, { type: 'declined', by: 'client', reason: reason ?? undefined, note: text || undefined }),
            },
          })
          await notifyEstimateAction(est, visitId, { kind: 'declined', reason: reason ? DECLINE_REASONS.en[reason] : null, note: text })
        }
        return NextResponse.json({ ok: true })
      }

      // The team proposed a date and the client takes it.
      case 'confirm_date': {
        if (closed) return fail('This estimate is already booked.', 409)
        const proposal = [...events].reverse().find(e => e.type === 'proposed')
        if (est.response !== 'accepted' || est.schedulingPending !== 'client' || !proposal?.date || !proposal.time) {
          return fail('There is no date waiting for your confirmation.', 409)
        }
        await prisma.estimate.update({
          where: { id: est.id },
          data: {
            schedulingPending: null,
            agreedDate: new Date(`${proposal.date}T00:00:00.000Z`), agreedTime: proposal.time,
            events: appendEvent(events, { type: 'confirmed', by: 'client', date: proposal.date, time: proposal.time }),
          },
        })
        await notifyEstimateAction(est, visitId, { kind: 'confirmed', date: proposal.date, time: proposal.time })
        return NextResponse.json({ ok: true })
      }

      // The client asks for a different day — instead of the team's
      // proposal, or to change the one they picked when accepting.
      case 'suggest_date': {
        if (closed) return fail('This estimate is already booked.', 409)
        if (est.response !== 'accepted') return fail('Accept the estimate first.', 409)
        const date = validDay(body.date)
        const window = asWindow(body.window)
        if (!date || !window) return fail('Pick a day and a time of day.')
        const text = note(body.note)
        await prisma.estimate.update({
          where: { id: est.id },
          data: {
            schedulingPending: 'team', agreedDate: null, agreedTime: null,
            events: appendEvent(events, { type: 'suggested', by: 'client', date, window, note: text || undefined }),
          },
        })
        await notifyEstimateAction(est, visitId, { kind: 'suggested', date, window, note: text })
        return NextResponse.json({ ok: true })
      }

      default:
        return fail('Unknown action')
    }
  } catch (error) {
    console.error('POST /api/public/estimates/[token] error:', error)
    return fail('Something went wrong. Please try again or call us at (919) 322-9092.', 500)
  }
}
