export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { sendPlainEmail } from '@/lib/email'
import { asLang, ymd } from '@/lib/estimate-flow'
import { visitConfirmation } from '@/lib/estimate-emails'

// POST /api/estimate-visits/[id]/confirm  { via: 'email' | 'sms', lang?, updated? }
//
// Tells the client their estimate visit is booked (or changed, with
// `updated`). By email it is sent from here; by text the app opens the
// phone's Messages with the returned `sms` body, since the office sends
// texts from its own phone, not through a provider.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const via = body.via === 'sms' ? 'sms' : 'email'

    const visit = await prisma.estimateVisit.findUnique({
      where: { id },
      include: { client: { select: { email: true, phone: true } } },
    })
    if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const lang = asLang(body.lang ?? visit.lang)
    const msg = visitConfirmation(lang, {
      name: visit.name, date: ymd(visit.visitDate), time: visit.visitTime, address: visit.address, updated: !!body.updated,
    })

    if (via === 'email') {
      const to = visit.email || visit.client?.email
      if (!to) return NextResponse.json({ error: 'This visit has no email. Add one or send it by text.' }, { status: 400 })
      await sendPlainEmail(to, msg.subject, msg.html)
    } else if (!(visit.phone || visit.client?.phone)) {
      return NextResponse.json({ error: 'This visit has no phone number.' }, { status: 400 })
    }

    await prisma.estimateVisit.update({
      where: { id },
      data: { confirmationSentAt: new Date(), confirmationVia: via, lang },
    })

    return NextResponse.json({ success: true, via, sms: via === 'sms' ? msg.sms : undefined, phone: visit.phone || visit.client?.phone || null })
  } catch (error) {
    console.error('POST /api/estimate-visits/[id]/confirm error:', error)
    return NextResponse.json({ error: 'Failed to send the confirmation' }, { status: 500 })
  }
}
