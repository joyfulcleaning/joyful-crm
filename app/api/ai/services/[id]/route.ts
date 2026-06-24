export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { rescheduleOrCancelService } from '@/lib/ai-handlers'

// PATCH /api/ai/services/:id
// Reschedules and/or cancels a service. `callerPhone` is required and must
// match the owning client's phone/contactPhone — without this, the caller
// could cancel or move someone else's appointment just by guessing/asking
// for a serviceId.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await context.params
    const args = await request.json()
    const { status, body } = await rescheduleOrCancelService(id, args)
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in PATCH /api/ai/services/[id]:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}
