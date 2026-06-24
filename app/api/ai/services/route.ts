export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { listClientServices, createService } from '@/lib/ai-handlers'

// GET /api/ai/services?clientId=&phone=
// Lists a client's services (past and upcoming) so the assistant can find
// which one a caller means before rescheduling/cancelling, or answer
// questions about a past visit. Requires clientId or phone.
export async function GET(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  try {
    const { status, body } = await listClientServices(searchParams.get('clientId'), searchParams.get('phone'))
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in GET /api/ai/services:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

// POST /api/ai/services
// Books a real cleaning service from a phone call. If the caller isn't an
// existing client, a new Client is created with price 0 (the owner fills it
// in later) — pricing for known clients reuses the same lookup the dashboard
// ServiceModal uses, so there's a single source of truth for prices.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const args = await request.json()
    const { status, body } = await createService(args)
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in POST /api/ai/services:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
