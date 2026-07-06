export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { notifyEvent } from '@/lib/notify-admin'

const TIMEZONE = 'America/New_York'

function tomorrowDate(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0')
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day') + 1))
}

// Status check for the mobile "Publish schedule" button — lets it show
// "Already published" instead of a plain action button once tomorrow is done.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const date = tomorrowDate()
    const existing = await prisma.publishedSchedule.findUnique({ where: { date } })
    return NextResponse.json({
      date: date.toISOString().slice(0, 10),
      published: !!existing,
      publishedAt: existing?.publishedAt ?? null,
    })
  } catch (error) {
    console.error('GET /api/schedule/publish:', error)
    return NextResponse.json({ error: 'Failed to check publish status' }, { status: 500 })
  }
}

// Publishes tomorrow's schedule to staff and pushes a notification. Always
// targets tomorrow (Eastern) — the admin is expected to have already
// reviewed/assigned routes and staff for that day before pressing this.
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const date = tomorrowDate()
    const existing = await prisma.publishedSchedule.findUnique({ where: { date } })
    if (existing) {
      return NextResponse.json({
        date: date.toISOString().slice(0, 10),
        published: true,
        alreadyPublished: true,
        publishedAt: existing.publishedAt,
      })
    }

    const record = await prisma.publishedSchedule.create({
      data: { date, publishedById: authUser.id },
    })

    const dateLabel = date.toLocaleDateString('en-US', { timeZone: TIMEZONE, weekday: 'long', month: 'long', day: 'numeric' })
    await notifyEvent('schedulePublished', {
      pushTitle: 'Schedule published',
      pushBody:  `Tomorrow's service schedule (${dateLabel}) is ready — check your calendar.`,
      pushData:  { type: 'schedulePublished', date: record.date.toISOString().slice(0, 10) },
      emailSubject: `Schedule published for ${dateLabel}`,
      emailHtml: `<p>The service schedule for <strong>${dateLabel}</strong> has been published and is now visible to staff in the app.</p>`,
    })

    return NextResponse.json({
      date: record.date.toISOString().slice(0, 10),
      published: true,
      alreadyPublished: false,
      publishedAt: record.publishedAt,
    })
  } catch (error) {
    console.error('POST /api/schedule/publish:', error)
    return NextResponse.json({ error: 'Failed to publish schedule' }, { status: 500 })
  }
}
