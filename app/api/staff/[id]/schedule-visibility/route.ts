export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

const ALLOWED = ['1', '2', '3', '4', 'week', 'full']

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
    const { value } = await request.json()
    if (!ALLOWED.includes(value)) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { scheduleVisibility: value },
      select: { id: true, scheduleVisibility: true },
    })
    return NextResponse.json(user)
  } catch (error) {
    console.error('PATCH /api/staff/[id]/schedule-visibility:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
