export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

const AUDIT_LIMIT = 200

// What the HR file needs beyond the person's own row: their audit trail (edits
// to the file plus anything logged against them by staffId) and work counts
// from real services, since there are no client ratings to show.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const year = new Date().getFullYear()
    const yearStart = new Date(`${year}-01-01T00:00:00Z`)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')

    const [audit, completedYear, completed90, cancelledYear, lastService, nextService] = await Promise.all([
      prisma.auditLog.findMany({
        where: { OR: [{ entity: 'staff', entityId: id }, { details: { path: ['staffId'], equals: id } }] },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: AUDIT_LIMIT,
      }),
      prisma.serviceStaff.count({ where: { userId: id, service: { status: 'completed', serviceDate: { gte: yearStart } } } }),
      prisma.serviceStaff.count({ where: { userId: id, service: { status: 'completed', serviceDate: { gte: ninetyDaysAgo } } } }),
      prisma.serviceStaff.count({ where: { userId: id, service: { status: 'cancelled', serviceDate: { gte: yearStart } } } }),
      prisma.service.findFirst({
        where: { status: 'completed', staff: { some: { userId: id } } },
        orderBy: { serviceDate: 'desc' }, select: { serviceDate: true },
      }),
      prisma.service.findFirst({
        where: { status: { in: ['pending', 'reschedule'] }, serviceDate: { gte: today }, staff: { some: { userId: id } } },
        orderBy: { serviceDate: 'asc' }, select: { serviceDate: true },
      }),
    ])

    return NextResponse.json({
      audit: audit.map(a => ({ id: a.id, action: a.action, entity: a.entity, details: a.details, createdAt: a.createdAt, actor: a.user?.name })),
      stats: {
        completedYear, completed90, cancelledYear,
        lastService: lastService?.serviceDate ?? null,
        nextService: nextService?.serviceDate ?? null,
      },
    })
  } catch (error) {
    console.error('Error fetching staff history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
