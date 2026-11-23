export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthUser, getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { sendPushToUsers } from '@/lib/push'
import { parseDateOnly } from '@/lib/staff-profile-server'
import {
  ABSENCE_TYPES, ACTIVE_STATUSES, REASON_REQUIRED, absenceHours, isActive, parseHours, readTimeRange,
  timeInRange, workPatternOf,
} from '@/lib/staff-absence'

const SUGGESTIONS_PER_SERVICE = 3

const INCLUDE = {
  user:       { select: { id: true, name: true, staffGroupId: true } },
  reviewedBy: { select: { id: true, name: true } },
}

// The absence, the open services it leaves uncovered, and who could take each
// one: active staff with no absence that day, same group first, then whoever
// has the lightest day. Suggestions only; nothing is reassigned from here.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const absence = await prisma.staffAbsence.findUnique({ where: { id }, include: INCLUDE })
    if (!absence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const services = await prisma.service.findMany({
      where: {
        serviceDate: { gte: absence.startDate, lte: absence.endDate },
        status:      { in: ['pending', 'in_progress', 'reschedule'] },
        staff:       { some: { userId: absence.userId } },
      },
      select: {
        id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true,
        client: { select: { name: true } },
        staff:  { select: { userId: true } },
      },
      orderBy: [{ serviceDate: 'asc' }, { serviceTime: 'asc' }],
    })

    const crew = await prisma.user.findMany({
      where: { role: 'user', status: 'active', id: { not: absence.userId } },
      select: { id: true, name: true, staffGroupId: true },
    })
    const absent = await prisma.staffAbsence.findMany({
      where: {
        status:    { in: [...ACTIVE_STATUSES] },
        startDate: { lte: absence.endDate },
        endDate:   { gte: absence.startDate },
      },
      select: { userId: true, startDate: true, endDate: true },
    })
    const dayLoad = await prisma.serviceStaff.groupBy({
      by: ['userId'],
      where: { service: { serviceDate: { gte: absence.startDate, lte: absence.endDate }, status: { not: 'cancelled' } } },
      _count: { _all: true },
    })
    const load = new Map(dayLoad.map(r => [r.userId, r._count._all]))

    const affected = services.map(service => {
      const onService = new Set(service.staff.map(s => s.userId))
      const day = service.serviceDate.getTime()
      const away = new Set(absent
        .filter(a => a.startDate.getTime() <= day && a.endDate.getTime() >= day)
        .map(a => a.userId))
      const suggestions = crew
        .filter(c => !onService.has(c.id) && !away.has(c.id))
        .sort((a, b) => {
          const sameGroup = Number(b.staffGroupId === absence.user.staffGroupId && !!b.staffGroupId)
                          - Number(a.staffGroupId === absence.user.staffGroupId && !!a.staffGroupId)
          return sameGroup || (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
        })
        .slice(0, SUGGESTIONS_PER_SERVICE)
        .map(c => ({ id: c.id, name: c.name }))
      const { staff, ...rest } = service
      return { ...rest, suggestions }
    })

    // Every service on those days, so the whole day's distribution can be
    // weighed: `assigned` marks the absent person's, and `clash` the ones
    // whose start falls inside a part-day range (all of theirs on a full day).
    const allServices = await prisma.service.findMany({
      where: {
        serviceDate: { gte: absence.startDate, lte: absence.endDate },
        status:      { not: 'cancelled' },
      },
      select: {
        id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true, status: true,
        client: { select: { name: true } },
        staff:  { select: { userId: true, user: { select: { name: true } } } },
      },
      orderBy: [{ serviceDate: 'asc' }, { serviceTime: 'asc' }],
    })
    const dayServices = allServices.map(({ staff, ...service }) => {
      const assigned = staff.some(s => s.userId === absence.userId)
      const clash = assigned && (!absence.startTime || !absence.endTime
        || timeInRange(service.serviceTime, absence.startTime, absence.endTime))
      return { ...service, staffNames: staff.map(s => s.user.name), assigned, clash }
    })

    return NextResponse.json({ ...absence, affected, dayServices })
  } catch (error) {
    console.error('Error fetching absence:', error)
    return NextResponse.json({ error: 'Failed to fetch absence' }, { status: 500 })
  }
}

const TRANSITIONS: Record<string, { to: 'approved' | 'rejected' | 'cancelled'; from: string[] }> = {
  approve: { to: 'approved',  from: ['pending'] },
  reject:  { to: 'rejected',  from: ['pending'] },
  cancel:  { to: 'cancelled', from: ['pending', 'approved'] },
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

// What the absence says right now, in the shape kept as `originalRequest`.
function snapshotOf(a: any) {
  return {
    type: a.type, startDate: ymd(a.startDate), endDate: ymd(a.endDate),
    startTime: a.startTime, endTime: a.endTime, totalHours: Number(a.totalHours),
  }
}

async function editAbsence(authUser: AuthUser, absence: any, body: any) {
  const type = body.type ?? absence.type
  if (!ABSENCE_TYPES[type]) return NextResponse.json({ error: 'Invalid absence type' }, { status: 400 })
  const reason = body.reason === undefined ? absence.reason : String(body.reason).trim() || null
  if (REASON_REQUIRED.has(type) && !reason) {
    return NextResponse.json({ error: 'A reason is required for this type', code: 'reason_required' }, { status: 400 })
  }

  const from = String(body.startDate ?? ymd(absence.startDate)).slice(0, 10)
  const to   = String(body.endDate ?? body.startDate ?? ymd(absence.endDate)).slice(0, 10)
  const startDate = parseDateOnly(from), endDate = parseDateOnly(to)
  if (!startDate || !endDate) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  if (to < from) return NextResponse.json({ error: 'End date is before start date' }, { status: 400 })

  const range = readTimeRange(body.startTime, body.endTime)
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
  let partialHours = range.partialHours
  // Older partial requests only carry the hours, without a time range.
  if (partialHours === null && body.partialHours !== undefined && body.partialHours !== null && body.partialHours !== '') {
    partialHours = parseHours(body.partialHours)
    if (!partialHours || partialHours > 24) return NextResponse.json({ error: 'Invalid hours' }, { status: 400 })
  }
  if (partialHours !== null && from !== to) {
    return NextResponse.json({ error: 'Partial absences cover a single day' }, { status: 400 })
  }

  const overlap = await prisma.staffAbsence.findFirst({
    where: {
      id:        { not: absence.id },
      userId:    absence.userId,
      status:    { in: [...ACTIVE_STATUSES] },
      startDate: { lte: endDate },
      endDate:   { gte: startDate },
    },
  })
  if (overlap) return NextResponse.json({ error: 'Overlaps another absence', code: 'overlap' }, { status: 409 })

  const profile = await prisma.staffProfile.findUnique({ where: { userId: absence.userId }, select: { weeklySchedule: true } })
  let totalHours = absenceHours(from, to, partialHours, workPatternOf({ hrProfile: profile }))
  if (body.totalHours !== undefined && body.totalHours !== null && body.totalHours !== '') {
    const manual = parseHours(body.totalHours)
    if (manual === null) return NextResponse.json({ error: 'Invalid hours' }, { status: 400 })
    totalHours = manual
  }

  const before = snapshotOf(absence)
  const updated = await prisma.staffAbsence.update({
    where: { id: absence.id },
    data: {
      type, startDate, endDate, partialHours, totalHours,
      startTime: range.startTime,
      endTime:   range.endTime,
      reason,
      // Kept once: later edits never overwrite what was first asked for.
      originalRequest: absence.originalRequest ?? before,
    },
    include: INCLUDE,
  })

  // Dates and hours aren't sensitive, so the log keeps the values themselves.
  logAudit(authUser, 'update', 'staffAbsence', absence.id, {
    staffId: updated.userId, staffName: updated.user.name, action: 'edit', before, after: snapshotOf(updated),
  })
  return NextResponse.json(updated)
}

const PUSH_TITLES: Record<string, string> = {
  approved:  'Ausencia aprobada',
  rejected:  'Ausencia rechazada',
  cancelled: 'Ausencia cancelada',
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()
    const transition = TRANSITIONS[body.action]
    if (!transition && body.action !== 'edit') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const absence = await prisma.staffAbsence.findUnique({ where: { id } })
    if (!absence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = authUser.role === 'admin'

    // Correcting the record — dates, times, type, hours or reason — when
    // someone was away longer or shorter than they asked, or the schedule
    // can't know the hours. The status stays as it is.
    if (body.action === 'edit') {
      if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (!isActive(absence)) return NextResponse.json({ error: 'This absence is closed' }, { status: 409 })
      return editAbsence(authUser, absence, body)
    }

    // Staff can only withdraw their own request while it is still pending.
    const ownWithdrawal = absence.userId === authUser.id && body.action === 'cancel' && absence.status === 'pending'
    if (!isAdmin && !ownWithdrawal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!transition.from.includes(absence.status)) {
      return NextResponse.json({ error: `Cannot ${body.action} an absence that is ${absence.status}` }, { status: 409 })
    }

    const updated = await prisma.staffAbsence.update({
      where: { id },
      data: {
        status:       transition.to,
        reviewNote:   body.note?.trim() || null,
        reviewedById: authUser.id,
        reviewedAt:   new Date(),
      },
      include: INCLUDE,
    })

    logAudit(authUser, 'update', 'staffAbsence', id, {
      staffId: updated.userId, staffName: updated.user.name, action: body.action, from: absence.status,
    })

    if (absence.userId !== authUser.id) {
      const [y, m, d] = updated.startDate.toISOString().slice(0, 10).split('-')
      sendPushToUsers('staffAbsenceResolved', [absence.userId], PUSH_TITLES[transition.to],
        `${m}-${d}-${y}`, { type: 'staffAbsenceResolved', absenceId: id })
        .catch(err => console.error('Failed to notify absence decision:', err))
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating absence:', error)
    return NextResponse.json({ error: 'Failed to update absence' }, { status: 500 })
  }
}
