export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

// Groups are a staffing shortcut, not a permission boundary — any signed-in
// user may read the list. Creating and editing them is admin-only.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const groups = await prisma.staffGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(groups)
  } catch (error) {
    console.error('GET /api/staff-groups:', error)
    return NextResponse.json({ error: 'Failed to load staff groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })

    // New groups land at the end of the list unless the caller places them.
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : await prisma.staffGroup.count()

    const group = await prisma.staffGroup.create({
      data: {
        name,
        color:     body.color || null,
        sortOrder,
        isActive:  body.isActive ?? true,
      },
    })

    logAudit(authUser, 'create', 'staffGroup', group.id, { name: group.name })

    return NextResponse.json(group)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 })
    }
    console.error('POST /api/staff-groups:', error)
    return NextResponse.json({ error: 'Failed to create staff group' }, { status: 500 })
  }
}
