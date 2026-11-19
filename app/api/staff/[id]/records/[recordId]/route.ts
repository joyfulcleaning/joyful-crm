export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { parseDateOnly } from '@/lib/staff-profile-server'
import { RecordInputError, parseRecordValues } from '@/lib/staff-records'

const INCLUDE = { author: { select: { id: true, name: true } } }

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, recordId } = await context.params
    const existing = await prisma.staffRecord.findFirst({ where: { id: recordId, userId: id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { values } = await request.json()
    let parsed
    try {
      parsed = parseRecordValues(existing.kind, values, true)
    } catch (err) {
      if (err instanceof RecordInputError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }

    const record = await prisma.staffRecord.update({
      where: { id: recordId },
      data: {
        ...('date' in parsed.columns ? { date: parseDateOnly(parsed.columns.date) } : {}),
        ...('endDate' in parsed.columns ? { endDate: parseDateOnly(parsed.columns.endDate) } : {}),
        data: { ...(existing.data as Record<string, any>), ...parsed.data },
      },
      include: INCLUDE,
    })

    logAudit(authUser, 'update', 'staffRecord', recordId, {
      staffId: id, kind: existing.kind, fields: [...Object.keys(parsed.columns), ...Object.keys(parsed.data)],
    })
    return NextResponse.json(record)
  } catch (error) {
    console.error('Error updating staff record:', error)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, recordId } = await context.params
    const existing = await prisma.staffRecord.findFirst({ where: { id: recordId, userId: id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.staffRecord.delete({ where: { id: recordId } })
    logAudit(authUser, 'delete', 'staffRecord', recordId, { staffId: id, kind: existing.kind })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting staff record:', error)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
