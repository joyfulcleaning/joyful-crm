export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { clientSecretMatches, findClient, revokeToken } from '@/lib/oauth'

/**
 * RFC 7009 token revocation — what "Disconnect" in the ChatGPT connector UI
 * calls so a removed connector stops holding a live token.
 *
 * Always answers 200, even for an unknown token: per the RFC the client has no
 * business learning whether a token existed.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(request: Request) {
  const raw = await request.text()
  const params = Object.fromEntries(new URLSearchParams(raw))

  const clientId = params.client_id
  const token = params.token

  if (clientId && token) {
    const client = await findClient(clientId)
    if (client && clientSecretMatches(client, params.client_secret ?? null)) {
      await revokeToken(token, client.id)
    }
  }

  return new NextResponse(null, { status: 200, headers: { ...CORS, 'Cache-Control': 'no-store' } })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
