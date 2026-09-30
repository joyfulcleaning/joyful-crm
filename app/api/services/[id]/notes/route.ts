export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, type AuthUser } from '@/lib/mobile-auth'
import { assertUserCanAccess } from '@/lib/serviceVisibility'
import { sendPushToUsers } from '@/lib/push'

// Longest single message we store. Long enough for a real handover note,
// short enough that one paste can't blow up the thread.
const MAX_BODY = 2000

const NOTE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true, avatarInitials: true } },
} as const

// Admins reach any service; staff only their own assigned, in-window ones.
async function canReach(serviceId: string, user: AuthUser) {
  if (user.role === 'admin') return true
  return assertUserCanAccess(serviceId, user.id)
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (!(await canReach(id, authUser))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const notes = await prisma.serviceNote.findMany({
      where: { serviceId: id },
      select: NOTE_SELECT,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET /api/services/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (!(await canReach(id, authUser))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Staff can have note-writing revoked from their permissions card; admins
    // are never gated (see the admin full-access rule).
    if (authUser.role === 'user') {
      const perms = await prisma.userPermission.findUnique({
        where: { userId: authUser.id },
        select: { canAddNotes: true },
      })
      if (perms && !perms.canAddNotes) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const payload = await request.json().catch(() => null)
    const body = typeof payload?.body === 'string' ? payload.body.trim() : ''
    if (!body) return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 })

    const note = await prisma.serviceNote.create({
      data: { serviceId: id, authorId: authUser.id, body: body.slice(0, MAX_BODY) },
      select: NOTE_SELECT,
    })

    notifyThread(id, authUser, note.body).catch(err =>
      console.error('Error notifying service note:', err))

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('POST /api/services/[id]/notes:', error)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}

// Pushes the new message to the other side of the conversation: staff writing
// reaches the admins, an admin writing reaches the crew assigned to that
// service. The author never gets their own message back.
async function notifyThread(serviceId: string, author: AuthUser, body: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      serviceNumber: true,
      unit: true,
      roomSize: true,
      client: { select: { name: true } },
      staff: { select: { userId: true } },
    },
  })
  if (!service) return

  const recipientIds = author.role === 'admin'
    ? service.staff.map(s => s.userId)
    : (await prisma.user.findMany({
        where: { role: 'admin', status: 'active' },
        select: { id: true },
      })).map(u => u.id)

  const targets = recipientIds.filter(uid => uid !== author.id)
  if (targets.length === 0) return

  const label = [service.unit ?? service.roomSize, service.client?.name].filter(Boolean).join(' · ')
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body

  await sendPushToUsers(
    'serviceNote',
    targets,
    `${author.name} · #${service.serviceNumber}${label ? ` — ${label}` : ''}`,
    preview,
    { type: 'serviceNote', serviceId },
    { threadId: `service-notes-${serviceId}` },
  )
}
