import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { sendPlainEmail } from '@/lib/email'
import { sendPushToRoles } from '@/lib/push'

async function notifyAdminOfQuoteRequest(request: { id: string; summary: string; callerName: string | null; callerPhone: string | null; callerEmail: string | null }) {
  try {
    const [emailSetting, toggleSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'biz.email' } }),
      prisma.setting.findUnique({ where: { key: 'notif.quoteRequest' } }),
    ])
    const adminEmail = emailSetting?.value
    if (adminEmail && toggleSetting?.value !== 'false') {
      await sendPlainEmail(
        adminEmail,
        `New quote request: ${request.summary}`,
        `<p>Someone requested a quote on the website.</p>
         <p><b>From:</b> ${request.callerName || 'Unknown'} ${request.callerPhone || ''} ${request.callerEmail || ''}<br/>
         <b>Details:</b> ${request.summary}</p>
         <p><a href="https://joyful-crm.vercel.app/ai-requests">Review in the CRM</a></p>`
      )
    }
  } catch (err) {
    console.error('Error emailing admin of quote request:', err)
  }

  await sendPushToRoles('quoteRequest', 'New quote request', request.summary, { type: 'quoteRequest', requestId: request.id })
}

export type CreateQuoteRequestArgs = {
  name?: unknown
  phone?: unknown
  email?: unknown
  address?: unknown
  serviceNeeded?: unknown
  preferredDate?: unknown
  notes?: unknown
  sourceIp?: string | null
}

const str = (v: unknown) => typeof v === 'string' ? v.trim() : ''

export async function createQuoteRequest(args: CreateQuoteRequestArgs): Promise<{ status: number; body: any }> {
  const name = str(args.name)
  const phone = str(args.phone)
  const email = str(args.email)
  const address = str(args.address)
  const serviceNeeded = str(args.serviceNeeded)
  const preferredDate = str(args.preferredDate)
  const notes = str(args.notes)

  if (!name) return { status: 400, body: { error: 'name is required' } }
  if (!phone && !email) return { status: 400, body: { error: 'phone or email is required' } }

  const summary = `${name} wants a quote${serviceNeeded ? ` for ${serviceNeeded}` : ''}`

  const aiRequest = await prisma.aiRequest.create({
    data: {
      platform: 'website',
      type: 'quote_request',
      callerName: name,
      callerPhone: phone ? normalizePhone(phone) : null,
      callerEmail: email || null,
      summary,
      payload: {
        address: address || null,
        serviceNeeded: serviceNeeded || null,
        preferredDate: preferredDate || null,
        notes: notes || null,
        sourceIp: args.sourceIp || null,
      },
    },
  })

  await notifyAdminOfQuoteRequest(aiRequest)

  return { status: 201, body: { ok: true, requestId: aiRequest.id } }
}

// Counts quote_request AiRequests created from a given IP within the last
// `windowMs` — used by the public (unauthenticated) endpoint to rate-limit,
// since anyone can read the endpoint URL out of the website's client JS.
export async function countRecentQuoteRequestsFromIp(ip: string, windowMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - windowMs)
  return prisma.aiRequest.count({
    where: {
      type: 'quote_request',
      createdAt: { gte: cutoff },
      payload: { path: ['sourceIp'], equals: ip },
    },
  })
}
