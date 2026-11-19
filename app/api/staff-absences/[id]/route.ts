export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { sendPushToUsers } from '@/lib/push'
import { ACTIVE_STATUSES, isActive, parseHours } from '@/lib/staff-absence'

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

    return NextResponse.json({ ...absence, affected })
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
    if (!transition && body.action !== 'adjust') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const absence = await prisma.staffAbsence.findUnique({ where: { id } })
    if (!absence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = authUser.role === 'admin'

    // Correcting the hours, for rotating schedules or anything the suggestion
    // can't know. The status stays as it is.
    if (body.action === 'adjust') {
      if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (!isActive(absence)) return NextResponse.json({ error: 'This absence is closed' }, { status: 409 })
      const totalHours = parseHours(body.totalHours)
      if (totalHours === null) return NextResponse.json({ error: 'Invalid hours' }, { status: 400 })
      const adjusted = await prisma.staffAbsence.update({ where: { id }, data: { totalHours }, include: INCLUDE })
      logAudit(authUser, 'update', 'staffAbsence', id, {
        staffId: adjusted.userId, staffName: adjusted.user.name, action: 'adjust', from: Number(absence.totalHours), to: totalHours,
      })
      return NextResponse.json(adjusted)
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
