export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = process.env.CALENDAR_FEED_TOKEN
  if (!token) return NextResponse.json({ error: 'Calendar feed not configured' }, { status: 500 })

  const origin = new URL(request.url).origin
  return NextResponse.json({ url: `${origin}/api/calendar/services.ics?token=${token}` })
}
