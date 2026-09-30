export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

// Per-person notification opt-outs. Always scoped to the caller — there is no
// admin path here, since these are personal preferences rather than company
// settings (those live under the `notif.*` Setting keys).
//
// Absence of a row means enabled, so GET returns only what was explicitly
// changed and clients should treat a missing key as on.

// Events a person is allowed to mute for themselves. Keeps an arbitrary key
// from being written into the table.
const MUTABLE_EVENTS = ['serviceNote'] as const

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const prefs = await prisma.notificationPref.findMany({
      where: { userId: authUser.id },
      select: { eventKey: true, enabled: true },
    })

    // Return every mutable event resolved to its effective value, so clients
    // don't each have to re-implement the "missing means enabled" default.
    const byKey = new Map(prefs.map(p => [p.eventKey, p.enabled]))
    const result: Record<string, boolean> = {}
    for (const key of MUTABLE_EVENTS) result[key] = byKey.get(key) ?? true

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/notifications/prefs:', error)
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await request.json().catch(() => null)
    const eventKey = typeof payload?.eventKey === 'string' ? payload.eventKey : ''
    const enabled  = payload?.enabled

    if (!(MUTABLE_EVENTS as readonly string[]).includes(eventKey)) {
      return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }

    await prisma.notificationPref.upsert({
      where:  { userId_eventKey: { userId: authUser.id, eventKey } },
      update: { enabled },
      create: { userId: authUser.id, eventKey, enabled },
    })

    return NextResponse.json({ eventKey, enabled })
  } catch (error) {
    console.error('PATCH /api/notifications/prefs:', error)
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }
}
