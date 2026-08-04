export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isQuoteFormAuthorized } from '@/lib/ai-auth'
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

export async function POST(request: Request) {
  try {
    if (!isQuoteFormAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const serviceNeeded = typeof body.serviceNeeded === 'string' ? body.serviceNeeded.trim() : ''
    const preferredDate = typeof body.preferredDate === 'string' ? body.preferredDate.trim() : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!phone && !email) {
      return NextResponse.json({ error: 'phone or email is required' }, { status: 400 })
    }

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
          serviceNeeded: serviceNeeded || null,
          preferredDate: preferredDate || null,
          notes: notes || null,
        },
      },
    })

    await notifyAdminOfQuoteRequest(aiRequest)

    return NextResponse.json({ ok: true, requestId: aiRequest.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/quote-requests error:', error)
    return NextResponse.json({ error: 'Failed to submit quote request' }, { status: 500 })
  }
}
