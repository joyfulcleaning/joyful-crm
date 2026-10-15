export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { sendPlainEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { confirmationHtml, confirmationSubject } from '@/lib/service-emails'

/**
 * Sends the client a confirmation that their cleaning is on the calendar.
 *
 * `[id]` is the service the confirmation is about — for a recurring series
 * that's the first one created, and the caller passes every id it created in
 * `serviceIds` so the whole series goes out as ONE email instead of one per
 * occurrence. Ids that belong to another client are dropped rather than
 * trusted, since the list comes straight off the client form.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Emailing a customer is office work — cleaners never send one.
    if (authUser.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const root = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true, clientId: true, serviceNumber: true, serviceDate: true,
        serviceTime: true, type: true,
        client: { select: { name: true, email: true } },
      },
    })
    if (!root) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    const toEmail = (typeof body?.toEmail === 'string' && body.toEmail.trim()) || root.client?.email
    if (!toEmail) return NextResponse.json({ error: 'Client has no email on file' }, { status: 400 })

    const extraIds: string[] = Array.isArray(body?.serviceIds)
      ? body.serviceIds.filter((v: unknown) => typeof v === 'string' && v !== id)
      : []

    const siblings = extraIds.length > 0
      ? await prisma.service.findMany({
          // Same client only — the id list is caller-supplied, and a
          // confirmation must never leak another customer's schedule.
          where: { id: { in: extraIds }, clientId: root.clientId },
          select: { id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true },
        })
      : []

    const rows = [root, ...siblings].sort(
      (a, b) => a.serviceDate.getTime() - b.serviceDate.getTime()
    )

    await sendPlainEmail(
      toEmail,
      confirmationSubject(rows),
      confirmationHtml(root.client?.name || 'Customer', rows),
    )

    const sentIds = rows.map(r => r.id)
    await prisma.service.updateMany({ where: { id: { in: sentIds } }, data: { emailSent: true } })

    logAudit(authUser, 'update', 'service', root.id, {
      action: 'confirmationEmail',
      sentTo: toEmail,
      serviceCount: sentIds.length,
    })

    return NextResponse.json({ sentTo: toEmail, count: sentIds.length })
  } catch (error) {
    console.error('POST /api/services/[id]/email:', error)
    return NextResponse.json({ error: 'The confirmation email could not be sent' }, { status: 500 })
  }
}
