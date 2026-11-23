export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { ABSENCE_TYPES, DEFAULT_PATTERN, absenceHours, workPatternOf } from '@/lib/staff-absence'

const EXTRA_FEE_TYPES = new Set(['Deep Clean', 'Heavy Deep Clean'])

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates required' }, { status: 400 })
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate   = new Date(`${to}T23:59:59.999Z`)

    // Get all active staff (non-admin)
    const staffList = await prisma.user.findMany({
      where: { role: 'user', status: 'active' },
      orderBy: { name: 'asc' },
    })

    const absencesOf = await periodAbsences(staffList.map(u => u.id), from, to)

    const results = await Promise.all(staffList.map(async (user) => ({
      ...await payFor(user, fromDate, toDate),
      // Shown next to the pay so the admin can decide on any adjustment;
      // nothing here changes the amount on its own.
      absences: absencesOf.get(user.id) ?? [],
    })))

    return NextResponse.json(results)
  } catch (error) {
    console.error('Payroll calculate error:', error)
    return NextResponse.json({ error: 'Failed to calculate payroll' }, { status: 500 })
  }
}

// What the person earns in the period under their pay frequency.
async function payFor(user: any, fromDate: Date, toDate: Date) {
      const freq = user.scheduleType || 'weekly'

      if (freq === 'daily' || freq === 'per_service') {
        // Fetch all service assignments for this user in the date range
        const assignments = await prisma.serviceStaff.findMany({
          where: {
            userId: user.id,
            service: {
              serviceDate: { gte: fromDate, lte: toDate },
              status: { not: 'cancelled' },
            },
          },
          include: {
            service: {
              select: { serviceDate: true, roomSize: true, type: true },
            },
          },
        })

        if (freq === 'daily') {
          // Unique calendar dates (YYYY-MM-DD) where they had at least 1 service
          const daySet = new Set<string>()
          for (const a of assignments) {
            const d = a.service.serviceDate
            if (d) daySet.add(new Date(d).toISOString().split('T')[0])
          }
          const workedDays = Array.from(daySet).sort()
          const rate       = Number(user.hourlyRate) || 0
          const baseAmount = workedDays.length * rate

          return {
            ...userBase(user),
            workedDays,
            workedDaysCount: workedDays.length,
            count1BR: 0, count2BR: 0, count3BR: 0, countExtra: 0,
            baseAmount,
          }
        }

        // per_service
        const rates = (user.payRates as any) || {}
        let count1BR = 0, count2BR = 0, count3BR = 0, countExtra = 0

        for (const a of assignments) {
          const rs   = a.service.roomSize
          const type = a.service.type
          if (rs === '1BR') count1BR++
          else if (rs === '2BR') count2BR++
          else if (rs === '3BR') count3BR++
          if (EXTRA_FEE_TYPES.has(type || '')) countExtra++
        }

        const baseAmount =
          (Number(rates.per1BR)   || 0) * count1BR  +
          (Number(rates.per2BR)   || 0) * count2BR  +
          (Number(rates.per3BR)   || 0) * count3BR  +
          (Number(rates.extraFee) || 0) * countExtra

        return {
          ...userBase(user),
          workedDays: [], workedDaysCount: 0,
          count1BR, count2BR, count3BR, countExtra,
          baseAmount: parseFloat(baseAmount.toFixed(2)),
        }
      }

      // Fixed schedule (weekly / biweekly / monthly)
      const rate = Number(user.hourlyRate) || 0
      return {
        ...userBase(user),
        workedDays: [], workedDaysCount: 0,
        count1BR: 0, count2BR: 0, count3BR: 0, countExtra: 0,
        baseAmount: rate,
      }
}

// Approved and pending time off that touches the pay period, per person.
// `hoursInPeriod` is the part of it inside the period: the recorded hours
// when it falls entirely inside, else worked out from the person's schedule.
async function periodAbsences(userIds: string[], from: string, to: string) {
  const periodFrom = new Date(`${from}T00:00:00.000Z`)
  const periodTo   = new Date(`${to}T00:00:00.000Z`)
  const [absences, profiles] = await Promise.all([
    prisma.staffAbsence.findMany({
      where: {
        userId:    { in: userIds },
        status:    { in: ['approved', 'pending'] },
        startDate: { lte: periodTo },
        endDate:   { gte: periodFrom },
      },
      orderBy: { startDate: 'asc' },
    }),
    prisma.staffProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, weeklySchedule: true } }),
  ])
  const patternOf = new Map(profiles.map(p => [p.userId, workPatternOf({ hrProfile: p })]))

  const byUser = new Map<string, any[]>()
  for (const a of absences) {
    const start = a.startDate.toISOString().slice(0, 10), end = a.endDate.toISOString().slice(0, 10)
    const inside = start >= from && end <= to
    const hoursInPeriod = inside
      ? Number(a.totalHours)
      : absenceHours(start > from ? start : from, end < to ? end : to, a.partialHours ? Number(a.partialHours) : null,
          patternOf.get(a.userId) ?? DEFAULT_PATTERN)
    const row = {
      id: a.id, type: a.type, status: a.status, startDate: start, endDate: end,
      startTime: a.startTime, endTime: a.endTime, totalHours: Number(a.totalHours), hoursInPeriod,
      bucket: ABSENCE_TYPES[a.type]?.bucket ?? null,
    }
    byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), row])
  }
  return byUser
}

function userBase(user: any) {
  return {
    userId:       user.id,
    name:         user.name,
    scheduleType: user.scheduleType,
    hourlyRate:   user.hourlyRate ? Number(user.hourlyRate) : null,
    payRates:     user.payRates ?? null,
  }
}
