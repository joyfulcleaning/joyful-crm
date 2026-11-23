export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { getVisibleServiceDates } from '@/lib/serviceVisibility'
import { eachDay } from '@/lib/staff-absence'

// How far back the calendar asks about; older time off has nothing to plan.
const PAST_DAYS = 120

// Who is off on which day, for the calendar's "off this day" card.
// Admins get pending and approved time off with its type, to plan around it.
// Staff get only approved time off, only the name and the hours — never the
// type or reason — and only on days whose schedule they can already see.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = authUser.role === 'admin'

    const since = new Date()
    since.setDate(since.getDate() - PAST_DAYS)

    const absences = await prisma.staffAbsence.findMany({
      where: {
        status:  { in: isAdmin ? ['pending', 'approved'] : ['approved'] },
        endDate: { gte: since },
      },
      select: {
        id: true, type: true, status: true, startDate: true, endDate: true, startTime: true, endTime: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    if (isAdmin) {
      return NextResponse.json(absences.map(a => ({
        id: a.id, userId: a.user.id, name: a.user.name, type: a.type, status: a.status,
        startDate: ymd(a.startDate), endDate: ymd(a.endDate), startTime: a.startTime, endTime: a.endTime,
      })))
    }

    const visibility = await getVisibleServiceDates(authUser.id)
    const visible = visibility.unrestricted ? null : new Set(visibility.dates)
    const rows = absences.flatMap(a => {
      const from = ymd(a.startDate), to = ymd(a.endDate)
      const days = visible ? eachDay(from, to).filter(d => visible.has(d)) : null
      if (days && days.length === 0) return []
      return [{
        userId: a.user.id, name: a.user.name, startDate: from, endDate: to,
        startTime: a.startTime, endTime: a.endTime,
        // Only these days may show the card; null means every day of the range.
        days,
      }]
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching absence calendar:', error)
    return NextResponse.json({ error: 'Failed to fetch absence calendar' }, { status: 500 })
  }
}
