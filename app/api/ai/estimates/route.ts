export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { createSqftEstimate } from '@/lib/ai-handlers'

// POST /api/ai/estimates
// Calculates a post-construction estimate from SQFT and emails the PDF to
// the client — the price is never returned to the caller (AI), only a
// confirmation that it was sent. Reuses the same PDF/email pipeline as the
// dashboard's "Send Estimate" action.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const args = await request.json()
    const { status, body } = await createSqftEstimate(args)
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in POST /api/ai/estimates:', error)
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 })
  }
}
