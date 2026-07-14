export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyEvent } from '@/lib/notify-admin'

const STALE_AFTER_MS = 2 * 60 * 60 * 1000 // 2 hours

// Business is Eastern-time based (Fayetteville, NC) — Settings has an
// app.timezone dropdown but it isn't wired into any server logic yet, so
// this just hardcodes the one timezone the business actually operates in.
function isBusinessHours(now: Date): boolean {
  const hour = Number(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }))
  return hour >= 7 && hour < 19
}

async function checkBusinessPhone() {
  const now = new Date()
  if (!isBusinessHours(now)) return { skipped: 'outside business hours' }

  const updatedSetting = await prisma.setting.findUnique({ where: { key: 'businessPhone.updatedAt' } })
  if (!updatedSetting?.value) return { skipped: 'never reported' }

  const lastUpdate = new Date(updatedSetting.value)
  const staleMs = now.getTime() - lastUpdate.getTime()
  if (staleMs < STALE_AFTER_MS) return { skipped: 'reporting normally', staleMinutes: Math.round(staleMs / 60000) }

  const staleHours = Math.round(staleMs / 3600000)
  await notifyEvent('businessPhoneOffline', {
    pushTitle: 'Business phone stopped reporting',
    pushBody:  `No location update in ${staleHours}h. Check that the app is open on the business phone.`,
    emailSubject: 'Joyful CRM — Business phone stopped reporting',
    emailHtml: `<p>The shared business phone hasn't shared its location in <strong>${staleHours} hours</strong>.</p><p>Someone likely needs to open the Joyful app on that phone to resume tracking (see Menu → Admin → Share this phone's location).</p>`,
  })

  return { alerted: true, staleHours }
}

// Vercel Cron calls GET — protected by CRON_SECRET in production
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await checkBusinessPhone()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Cron check-business-phone:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
