export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { asLang, ensurePublicToken, estimateLink, sentUpdate } from '@/lib/estimate-flow'
import { estimateSms } from '@/lib/estimate-emails'

// POST /api/estimates/[id]/text  { lang? }
// The office texts from its own phone, so nothing is sent from here: this
// records the send and returns the message (with the acceptance link) for
// the app to drop into Messages.
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

    const lang = asLang(body.lang ?? est.lang)
    const token = await ensurePublicToken(est.id, est.publicToken)
    const link = estimateLink(token, req)

    await prisma.estimate.update({ where: { id }, data: sentUpdate(est, 'sms', lang, authUser.name) })

    return NextResponse.json({
      sms: estimateSms(lang, { clientName: est.clientName, estimateNumber: est.estimateNumber, total: Number(est.total), link }),
      phone: est.clientPhone,
      link,
    })
  } catch (error) {
    console.error('POST /api/estimates/[id]/text error:', error)
    return NextResponse.json({ error: 'Failed to prepare the text' }, { status: 500 })
  }
}
