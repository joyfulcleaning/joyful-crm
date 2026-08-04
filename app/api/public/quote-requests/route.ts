export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createQuoteRequest, countRecentQuoteRequestsFromIp } from '@/lib/quote-requests'

// Public, unauthenticated variant for the "Get a Quote" form on the
// marketing website. That site is static HTML/JS with no server of its own,
// so any token embedded in its client-side code is visible to anyone who
// views source — there is no secret that can actually stay hidden there.
// Abuse is mitigated instead by: an allowlisted CORS origin (blocks casual
// reuse from other sites' browser JS — NOT a security boundary against a
// determined caller using curl, since CORS is enforced by browsers only),
// a honeypot field, and a per-IP rate limit backed by the database (so it
// holds even across separate serverless instances).

const ALLOWED_ORIGINS = [
  'https://joyfulcleaningservicesnc.com',
  'https://www.joyfulcleaningservicesnc.com',
]

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'))
  try {
    const body = await request.json()

    // Honeypot: a real visitor never sees/fills this field (hidden via CSS
    // on the form); a bot filling every input trips it. Respond as if it
    // succeeded so the bot doesn't learn to avoid the field, but don't
    // actually create anything or send any notification.
    if (typeof body.company === 'string' && body.company.trim() !== '') {
      return NextResponse.json({ ok: true, requestId: 'ok' }, { status: 201, headers })
    }

    const ip = clientIp(request)
    if (ip) {
      const recentCount = await countRecentQuoteRequestsFromIp(ip, RATE_LIMIT_WINDOW_MS)
      if (recentCount >= RATE_LIMIT_MAX) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers })
      }
    }

    const { status, body: result } = await createQuoteRequest({ ...body, sourceIp: ip })
    return NextResponse.json(result, { status, headers })
  } catch (error) {
    console.error('POST /api/public/quote-requests error:', error)
    return NextResponse.json({ error: 'Failed to submit quote request' }, { status: 500, headers })
  }
}
