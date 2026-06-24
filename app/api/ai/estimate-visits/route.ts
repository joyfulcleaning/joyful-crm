export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { scheduleEstimateVisit } from '@/lib/ai-handlers'

// POST /api/ai/estimate-visits
// Books an in-person visit to quote a prospective client. Independent of the
// Service scheduling grid on purpose — it doesn't compete for the same slot
// and isn't blocked by (or blocking to) an already-booked Service.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const args = await request.json()
    const { status, body } = await scheduleEstimateVisit(args)
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in POST /api/ai/estimate-visits:', error)
    return NextResponse.json({ error: 'Failed to create estimate visit' }, { status: 500 })
  }
}
