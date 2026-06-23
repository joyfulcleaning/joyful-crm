export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'
import { HOURLY_SLOTS, nowInEastern } from '@/lib/scheduling'

// GET /api/ai/availability?date=YYYY-MM-DD
// Slots are hourly, 8am-5pm. A slot counts as taken once one active service
// occupies it — one crew per hour, per the current scheduling rule.
export async function GET(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query param is required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const services = await prisma.service.findMany({
      where: {
        serviceDate: new Date(`${date}T00:00:00.000Z`),
        status: { not: 'cancelled' },
      },
      select: { serviceTime: true },
    })
    const taken = new Set(services.map(s => s.serviceTime))

    const now = nowInEastern()
    const isToday = date === now.date

    const slots = HOURLY_SLOTS
      .filter(time => !isToday || Number(time.slice(0, 2)) > now.hour)
      .map(time => ({ time, available: !taken.has(time) }))

    return NextResponse.json({
      date,
      slots,
      availableTimes: slots.filter(s => s.available).map(s => s.time),
    })
  } catch (error) {
    console.error('Error in /api/ai/availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}
