export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { ABSENCE_TYPES, absenceHours, balances, workPatternOf } from '@/lib/staff-absence'

// What the mobile time-off tab needs about the signed-in person, without
// handing staff their whole HR file: this year's hour balances and, when
// `from` is given, how many hours a request for those dates would spend.
// Hours are worked out here so the app never re-implements the schedule rules.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = authUser.role === 'admin' ? searchParams.get('userId') || authUser.id : authUser.id
    const year = new Date().getFullYear()

    const [profile, absences] = await Promise.all([
      prisma.staffProfile.findUnique({
        where: { userId },
        select: { weeklySchedule: true, vacationHours: true, sickHours: true, personalHours: true },
      }),
      prisma.staffAbsence.findMany({
        where: { userId, status: { in: ['pending', 'approved'] } },
        select: { userId: true, type: true, status: true, startDate: true, totalHours: true },
      }),
    ])
    const member = { id: userId, hrProfile: profile }
    const rows = absences.map(a => ({ ...a, startDate: a.startDate.toISOString() }))
    const pattern = workPatternOf(member)

    let preview: { hours: number; bucket: string | null } | null = null
    const from = searchParams.get('from')?.slice(0, 10)
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      const toParam = searchParams.get('to')?.slice(0, 10)
      const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) && toParam >= from ? toParam : from
      const partial = Number(searchParams.get('partialHours'))
      const partialHours = from === to && Number.isFinite(partial) && partial > 0 && partial <= 24 ? partial : null
      preview = {
        hours:  absenceHours(from, to, partialHours, pattern),
        bucket: ABSENCE_TYPES[searchParams.get('type') ?? '']?.bucket ?? null,
      }
    }

    return NextResponse.json({ year, balances: balances(member, rows, year), rotating: pattern.rotating, preview })
  } catch (error) {
    console.error('Error fetching absence summary:', error)
    return NextResponse.json({ error: 'Failed to fetch absence summary' }, { status: 500 })
  }
}
