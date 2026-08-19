export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { sendPlainEmail } from '@/lib/email'
import { buildRequestEmailHtml, customerFacingRows, langOf, requestEmailSubject } from '@/lib/request-email'

// Sends the staff-written message to the customer from the business account,
// the same way invoices go out — as opposed to handing it to the phone's mail
// app. Sending is deliberately separate from resolving the request: staff can
// email a lead as many times as the back-and-forth needs while it stays
// pending.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const message: string = typeof body?.message === 'string' ? body.message.trim() : ''
    const toOverride: string | undefined = typeof body?.toEmail === 'string' ? body.toEmail.trim() : undefined
    const lang = langOf(body?.locale)

    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

    const aiRequest = await prisma.aiRequest.findUnique({ where: { id } })
    if (!aiRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const to = toOverride || aiRequest.callerEmail
    if (!to) return NextResponse.json({ error: 'This request has no email on file' }, { status: 400 })

    // The staff may have corrected/completed the details in the app before
    // writing the message — send the recap they are actually looking at.
    const payload = { ...(aiRequest.payload as any), ...(body?.editedPayload || {}) }
    const requestCode = id.replace(/-/g, '').slice(-4).toUpperCase()
    const typeLabel: string = typeof body?.typeLabel === 'string' && body.typeLabel.trim()
      ? body.typeLabel.trim()
      : 'Your request'

    await sendPlainEmail(
      to,
      requestEmailSubject(typeLabel, lang),
      buildRequestEmailHtml({
        customerName: aiRequest.callerName,
        message,
        rows: customerFacingRows(aiRequest.type, payload, lang, aiRequest.summary),
        requestCode,
        lang,
      })
    )

    // AiRequest has no column for this, and the payload is free-form Json —
    // keeping the send log there avoids a schema migration. resolveAiRequest
    // merges edits over the stored payload, so these keys survive.
    await prisma.aiRequest.update({
      where: { id },
      data: {
        customerMessage: message,
        payload: {
          ...(aiRequest.payload as any),
          emailSentAt: new Date().toISOString(),
          emailSentTo: to,
        },
      },
    })

    return NextResponse.json({ success: true, sentTo: to })
  } catch (error) {
    console.error('POST /api/ai-requests/[id]/email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
