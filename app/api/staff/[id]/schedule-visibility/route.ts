export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

// 'future' = how far ahead they see published days; 'past' = how many
// already-worked days stay visible behind today.
const ALLOWED: Record<string, string[]> = {
  future: ['1', '2', '3', '4', 'week', 'full'],
  past:   ['0', 'week', '7', '14', '30'],
}
const COLUMN: Record<string, 'scheduleVisibility' | 'schedulePastVisibility'> = {
  future: 'scheduleVisibility',
  past:   'schedulePastVisibility',
}

// Dedicated, single-field endpoint — kept separate from PATCH /api/staff/[id]
// (which resubmits the whole profile form) so toggling this from a staff
// member's card can't accidentally null out their other fields.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    // `field` is optional so older clients that only know about the
    // look-ahead window keep working unchanged.
    const { value, field = 'future' } = await request.json()
    if (!ALLOWED[field]) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }
    if (!ALLOWED[field].includes(value)) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { [COLUMN[field]]: value },
      select: { id: true, scheduleVisibility: true, schedulePastVisibility: true },
    })
    return NextResponse.json(user)
  } catch (error) {
    console.error('PATCH /api/staff/[id]/schedule-visibility:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
