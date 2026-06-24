export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { checkAvailability } from '@/lib/ai-handlers'

// GET /api/ai/availability?date=YYYY-MM-DD
// Slots are hourly, 8am-5pm. A slot counts as taken once one active service
// occupies it — one crew per hour, per the current scheduling rule.
export async function GET(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  try {
    const { status, body } = await checkAvailability(searchParams.get('date'))
    return NextResponse.json(body, { status })
  } catch (error) {
    console.error('Error in /api/ai/availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}
