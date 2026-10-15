export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPlainEmail } from '@/lib/email'
import { reminderHtml, reminderSubject } from '@/lib/service-emails'

/**
 * Day-before reminder to the client, for services with the reminder toggle on.
 *
 * Runs every morning (see vercel.json). Opt-in per service and stamped with
 * `reminderSentAt` on the way out, so a service is never reminded twice even
 * if the cron fires again or is replayed by hand.
 *
 * Vercel Cron calls GET — protected by CRON_SECRET in production.
 */

const BUSINESS_TZ = 'America/New_York'

// "Tomorrow" has to be tomorrow where the crews actually work, not in UTC: the
// cron fires in the morning ET, which is the same calendar day in UTC, but
// deriving the date from UTC would break the moment the schedule or the
// timezone changes. en-CA formats as YYYY-MM-DD.
function businessDatePlusDays(days: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ })
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const target = businessDatePlusDays(1)

    const services = await prisma.service.findMany({
      where: {
        // serviceDate is a `@db.Date`, stored at midnight UTC — an exact match
        // on the day is all that's needed, no range.
        serviceDate:    new Date(`${target}T00:00:00.000Z`),
        sendReminder:   true,
        reminderSentAt: null,
        status:         { notIn: ['cancelled', 'completed'] },
        client:         { email: { not: null } },
      },
      select: {
        id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true,
        client: { select: { name: true, email: true } },
      },
      orderBy: { serviceTime: 'asc' },
    })

    let sent = 0
    const failed: { id: string; error: string }[] = []

    for (const svc of services) {
      const to = svc.client?.email
      if (!to) continue
      try {
        await sendPlainEmail(
          to,
          reminderSubject(svc),
          reminderHtml(svc.client?.name || 'Customer', svc),
        )
        // Stamped per service right after its own send, so a failure halfway
        // through the batch never re-sends the ones that already went out.
        await prisma.service.update({
          where: { id: svc.id },
          data:  { reminderSentAt: new Date() },
        })
        sent++
      } catch (err: unknown) {
        console.error(`Reminder failed for service ${svc.id}:`, err)
        failed.push({ id: svc.id, error: err instanceof Error ? err.message : 'send failed' })
      }
    }

    return NextResponse.json({ ok: true, date: target, found: services.length, sent, failed })
  } catch (error) {
    console.error('Cron send-service-reminders:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
