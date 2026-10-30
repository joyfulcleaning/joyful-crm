export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { registerClient } from '@/lib/oauth'

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Open by necessity — an MCP client has to obtain a client_id before any user
 * is involved, so there is no session to authenticate here. This is safe
 * because registration grants nothing: the client still cannot read a byte of
 * CRM data until an admin approves the consent screen at /oauth/authorize and
 * a token is minted against their account.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Body must be JSON' },
      { status: 400, headers: CORS }
    )
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'Body must be a JSON object' },
      { status: 400, headers: CORS }
    )
  }

  const result = await registerClient(body as Record<string, unknown>)
  if ('error' in result) {
    return NextResponse.json(result.error, { status: 400, headers: CORS })
  }

  return NextResponse.json(result.registration, { status: 201, headers: CORS })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
