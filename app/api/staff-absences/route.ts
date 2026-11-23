export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { notifyEvent } from '@/lib/notify-admin'
import { parseDateOnly } from '@/lib/staff-profile-server'
import { ABSENCE_TYPES, ACTIVE_STATUSES, REASON_REQUIRED, absenceHours, parseHours, readTimeRange, timeRangeText, workPatternOf } from '@/lib/staff-absence'

const INCLUDE = {
  user:       { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
}

// Admins see everyone; staff only ever get their own rows.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = authUser.role === 'admin' ? searchParams.get('userId') || undefined : authUser.id

    const absences = await prisma.staffAbsence.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: 'Failed to fetch absences' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const isAdmin = authUser.role === 'admin'
    const userId: string = isAdmin ? body.userId : authUser.id
    // Only an admin can log time off as already approved.
    const status = isAdmin && body.status === 'approved' ? 'approved' : 'pending'

    if (!userId) return NextResponse.json({ error: 'Staff member is required' }, { status: 400 })
    if (!ABSENCE_TYPES[body.type]) return NextResponse.json({ error: 'Invalid absence type' }, { status: 400 })
    if (REASON_REQUIRED.has(body.type) && !String(body.reason ?? '').trim()) {
      return NextResponse.json({ error: 'A reason is required for this type', code: 'reason_required' }, { status: 400 })
    }

    const startDate = parseDateOnly(body.startDate)
    const endDate   = parseDateOnly(body.endDate ?? body.startDate)
    if (!startDate || !endDate) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })

    const from = String(body.startDate).slice(0, 10)
    const to   = String(body.endDate ?? body.startDate).slice(0, 10)
    if (to < from) return NextResponse.json({ error: 'End date is before start date' }, { status: 400 })

    // A part of a day comes as a time range and the hours follow from it. A
    // bare partialHours is still accepted for callers that only know the hours.
    const range = readTimeRange(body.startTime, body.endTime)
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
    let partialHours: number | null = range.partialHours
    if (range.partialHours !== null && from !== to) {
      return NextResponse.json({ error: 'Partial absences cover a single day' }, { status: 400 })
    }
    if (partialHours === null && body.partialHours !== undefined && body.partialHours !== null && body.partialHours !== '') {
      partialHours = Number(body.partialHours)
      if (!Number.isFinite(partialHours) || partialHours <= 0 || partialHours > 24) {
        return NextResponse.json({ error: 'Invalid hours' }, { status: 400 })
      }
      if (from !== to) return NextResponse.json({ error: 'Partial absences cover a single day' }, { status: 400 })
    }

    const overlap = await prisma.staffAbsence.findFirst({
      where: {
        userId,
        status:    { in: [...ACTIVE_STATUSES] },
        startDate: { lte: endDate },
        endDate:   { gte: startDate },
      },
    })
    if (overlap) return NextResponse.json({ error: 'Overlaps another absence', code: 'overlap' }, { status: 409 })

    const profile = await prisma.staffProfile.findUnique({ where: { userId }, select: { weeklySchedule: true } })
    let totalHours = absenceHours(from, to, partialHours, workPatternOf({ hrProfile: profile }))
    // Only an admin can override the worked-out hours.
    if (isAdmin && body.totalHours !== undefined && body.totalHours !== null && body.totalHours !== '') {
      const manual = parseHours(body.totalHours)
      if (manual === null) return NextResponse.json({ error: 'Invalid hours' }, { status: 400 })
      totalHours = manual
    }

    const absence = await prisma.staffAbsence.create({
      data: {
        userId,
        type: body.type,
        startDate,
        endDate,
        partialHours,
        startTime: range.startTime,
        endTime:   range.endTime,
        totalHours,
        status,
        reason:        body.reason?.trim() || null,
        requestedById: authUser.id,
        ...(status === 'approved' ? { reviewedById: authUser.id, reviewedAt: new Date() } : {}),
      },
      include: INCLUDE,
    })

    logAudit(authUser, 'create', 'staffAbsence', absence.id, {
      staffId: absence.userId, staffName: absence.user.name, type: absence.type, from, to, status,
    })

    if (status === 'pending') {
      const mdy = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`
      const when = (from === to ? mdy(from) : `${mdy(from)} → ${mdy(to)}`)
        + (range.startTime ? `, ${timeRangeText(range)}` : '')
      notifyEvent('staffAbsence', {
        pushTitle:    'Solicitud de ausencia',
        pushBody:     `${absence.user.name}: ${when}`,
        pushData:     { type: 'staffAbsence', absenceId: absence.id },
        emailSubject: `Solicitud de ausencia: ${absence.user.name}`,
        emailHtml:    `<p>${absence.user.name} solicitó una ausencia: ${when}.</p><p>Revísala en Staff → Ausencias.</p>`,
      }).catch(err => console.error('Failed to notify absence request:', err))
    }

    return NextResponse.json(absence, { status: 201 })
  } catch (error) {
    console.error('Error creating absence:', error)
    return NextResponse.json({ error: 'Failed to create absence' }, { status: 500 })
  }
}
