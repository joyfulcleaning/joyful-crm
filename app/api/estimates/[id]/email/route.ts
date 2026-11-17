export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateEstimatePDF, estimateDataFrom } from '@/lib/estimate-pdf'
import { getAuthUser } from '@/lib/mobile-auth'
import { sendPlainEmail } from '@/lib/email'
import { asLang, ensurePublicToken, estimateLink, sentUpdate, ymd } from '@/lib/estimate-flow'
import { estimateEmail } from '@/lib/estimate-emails'

// POST /api/estimates/[id]/email  { lang? }
// Emails the estimate PDF plus the link where the client accepts, asks for
// changes, declines or asks a question. `lang` defaults to the estimate's.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const est = await prisma.estimate.findUnique({ where: { id } })
    if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!est.clientEmail) return NextResponse.json({ error: 'No email on this estimate' }, { status: 400 })

    const lang = asLang(body.lang ?? est.lang)
    const token = await ensurePublicToken(est.id, est.publicToken)
    const data = estimateDataFrom(est, lang)
    const msg = estimateEmail(lang, {
      clientName: est.clientName, estimateNumber: est.estimateNumber, total: Number(est.total),
      validUntil: ymd(est.validUntil), link: estimateLink(token, req),
    })

    const pdfBuffer = await generateEstimatePDF(data)
    await sendPlainEmail(est.clientEmail, msg.subject, msg.html, {
      attachments: [{ filename: `${lang === 'es' ? 'Cotizacion' : 'Estimate'}-${est.estimateNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    })

    await prisma.estimate.update({ where: { id }, data: sentUpdate(est, 'email', lang, authUser.name) })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/estimates/[id]/email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
