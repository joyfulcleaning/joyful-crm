export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { findClientByPhone } from '@/lib/ai-handlers'

// GET /api/ai/clients?phone=
// Used by the Vapi assistant to identify the caller. Never returns pricing
// or financial data — only what's needed to confirm identity and schedule.
export async function GET(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  try {
    const { status, body } = await findClientByPhone(searchParams.get('phone'))
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in /api/ai/clients:', error)
    return NextResponse.json({ error: 'Failed to search clients' }, { status: 500 })
  }
}
