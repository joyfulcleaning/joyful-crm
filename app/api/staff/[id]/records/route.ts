export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { parseDateOnly } from '@/lib/staff-profile-server'
import { RECORD_KINDS, RecordInputError, parseRecordValues } from '@/lib/staff-records'

const RECORD_INCLUDE = { author: { select: { id: true, name: true } } }

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const kind = new URL(request.url).searchParams.get('kind') || undefined
    const records = await prisma.staffRecord.findMany({
      where: { userId: id, kind },
      include: RECORD_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching staff records:', error)
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const { kind, values } = await request.json()
    if (!RECORD_KINDS[kind]) return NextResponse.json({ error: 'Unknown record kind' }, { status: 400 })

    let parsed
    try {
      parsed = parseRecordValues(kind, values)
    } catch (err) {
      if (err instanceof RecordInputError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }

    const person = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const record = await prisma.staffRecord.create({
      data: {
        userId:   id,
        kind,
        date:     parseDateOnly(parsed.columns.date),
        endDate:  parseDateOnly(parsed.columns.endDate),
        data:     parsed.data,
        authorId: authUser.id,
      },
      include: RECORD_INCLUDE,
    })

    // The kind only: record contents can include alarm codes and medical notes.
    logAudit(authUser, 'create', 'staffRecord', record.id, { staffId: id, kind })
    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Error creating staff record:', error)
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
  }
}
