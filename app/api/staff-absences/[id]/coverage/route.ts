export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { ACTIVE_STATUSES } from '@/lib/staff-absence'

// Swaps the absent person for a replacement on one service, and only ever when
// an admin confirms it. Approving an absence never reassigns anything by itself.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const { serviceId, replacementUserId } = await request.json()
    if (!serviceId || !replacementUserId) return NextResponse.json({ error: 'Service and replacement are required' }, { status: 400 })

    const absence = await prisma.staffAbsence.findUnique({ where: { id }, include: { user: { select: { name: true } } } })
    if (!absence) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (absence.status !== 'approved') return NextResponse.json({ error: 'Only an approved absence can be covered' }, { status: 409 })

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        serviceDate: { gte: absence.startDate, lte: absence.endDate },
        status:      { in: ['pending', 'in_progress', 'reschedule'] },
        staff:       { some: { userId: absence.userId } },
      },
      select: { id: true, serviceNumber: true, serviceDate: true, staff: { select: { userId: true } } },
    })
    if (!service) return NextResponse.json({ error: 'Service is not affected by this absence' }, { status: 409 })
    if (service.staff.some(s => s.userId === replacementUserId)) {
      return NextResponse.json({ error: 'Replacement is already on this service' }, { status: 409 })
    }

    const replacement = await prisma.user.findFirst({
      where: { id: replacementUserId, status: 'active' },
      select: { id: true, name: true },
    })
    if (!replacement) return NextResponse.json({ error: 'Replacement is not active staff' }, { status: 400 })

    const busy = await prisma.staffAbsence.findFirst({
      where: {
        userId:    replacementUserId,
        status:    { in: [...ACTIVE_STATUSES] },
        startDate: { lte: service.serviceDate },
        endDate:   { gte: service.serviceDate },
      },
    })
    if (busy) return NextResponse.json({ error: 'Replacement is absent that day' }, { status: 409 })

    await prisma.$transaction([
      prisma.serviceStaff.deleteMany({ where: { serviceId, userId: absence.userId } }),
      prisma.serviceStaff.create({ data: { serviceId, userId: replacementUserId } }),
    ])

    logAudit(authUser, 'update', 'service', serviceId, {
      serviceNumber: service.serviceNumber,
      coverageFor:   absence.user.name,
      replacedBy:    replacement.name,
      absenceId:     id,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error covering service:', error)
    return NextResponse.json({ error: 'Failed to assign coverage' }, { status: 500 })
  }
}
