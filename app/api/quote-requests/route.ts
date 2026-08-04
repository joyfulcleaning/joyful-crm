export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isQuoteFormAuthorized } from '@/lib/ai-auth'
import { createQuoteRequest } from '@/lib/quote-requests'

// Bearer-token-protected variant, for server-to-server callers that can
// actually keep a secret (Zapier, a backend script, etc). Browser-side forms
// on a static site can't hide a token — see /api/public/quote-requests.
export async function POST(request: Request) {
  try {
    if (!isQuoteFormAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, body: result } = await createQuoteRequest(body)
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('POST /api/quote-requests error:', error)
    return NextResponse.json({ error: 'Failed to submit quote request' }, { status: 500 })
  }
}
