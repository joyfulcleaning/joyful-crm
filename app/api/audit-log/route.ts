export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const action = searchParams.get('action')
    const search = searchParams.get('search')
    const limit  = Math.min(Number(searchParams.get('limit')) || 100, 300)

    const where: any = {}
    if (entity && entity !== 'all') where.entity = entity
    if (action && action !== 'all') where.action = action

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: search ? 1000 : limit,
    })

    const filtered = search
      ? logs.filter(l =>
          l.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
        ).slice(0, limit)
      : logs

    return NextResponse.json(filtered.map(l => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      details: l.details,
      userName: l.user?.name ?? 'Unknown',
      createdAt: l.createdAt,
    })))
  } catch (error) {
    console.error('GET /api/audit-log:', error)
    return NextResponse.json({ error: 'Failed to load activity log' }, { status: 500 })
  }
}
