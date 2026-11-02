export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    const existing = await prisma.staffGroup.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    // Only touch what the caller actually sent, so the group manager and the
    // staff profile can each patch their own slice without clobbering the rest.
    const data: Record<string, any> = {}
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
      data.name = name
    }
    if (body.color     !== undefined) data.color     = body.color || null
    if (body.isActive  !== undefined) data.isActive  = !!body.isActive
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
      data.sortOrder = Number(body.sortOrder)
    }

    // memberIds, when sent, replaces the whole roster: anyone listed joins the
    // group, anyone currently in it who is not listed is cleared. Both writes
    // go in one transaction so a half-applied roster can't be observed.
    const memberIds: string[] | null = Array.isArray(body.memberIds) ? body.memberIds : null

    const group = await prisma.$transaction(async (tx) => {
      if (memberIds) {
        await tx.user.updateMany({
          where: { staffGroupId: id, id: { notIn: memberIds } },
          data:  { staffGroupId: null },
        })
        if (memberIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: memberIds } },
            data:  { staffGroupId: id },
          })
        }
      }
      return Object.keys(data).length > 0
        ? tx.staffGroup.update({ where: { id }, data })
        : tx.staffGroup.findUniqueOrThrow({ where: { id } })
    })

    logAudit(authUser, 'update', 'staffGroup', group.id, {
      name: group.name,
      ...(memberIds ? { memberCount: memberIds.length } : {}),
    })

    return NextResponse.json(group)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 })
    }
    console.error('PATCH /api/staff-groups/[id]:', error)
    return NextResponse.json({ error: 'Failed to update staff group' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params

    const existing = await prisma.staffGroup.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    // Members are only unlinked (staffGroupId -> null by the FK's SetNull):
    // deleting a group never deletes people, and never touches the service
    // assignments they already have.
    await prisma.staffGroup.delete({ where: { id } })

    logAudit(authUser, 'delete', 'staffGroup', id, {
      name: existing.name,
      unlinkedMembers: existing._count.members,
    })

    return NextResponse.json({ ok: true, unlinkedMembers: existing._count.members })
  } catch (error) {
    console.error('DELETE /api/staff-groups/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete staff group' }, { status: 500 })
  }
}
