export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  clientSecretMatches,
  consumeAuthCode,
  findClient,
  issueTokenPair,
  rotateRefreshToken,
} from '@/lib/oauth'

/**
 * OAuth 2.1 token endpoint — authorization_code (with PKCE) and refresh_token.
 *
 * Form-encoded per the spec, but JSON bodies are also accepted because some
 * MCP clients send JSON here and debugging that mismatch from the ChatGPT side
 * is near-impossible (the failure surfaces only as "couldn't connect").
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Token responses must never be cached by an intermediary.
const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

function fail(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...CORS, ...NO_STORE } }
  )
}

async function readParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || ''
  const raw = await request.text()

  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw)
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed ?? {})) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    } catch {
      return {}
    }
  }

  return Object.fromEntries(new URLSearchParams(raw))
}

/** client_secret_basic credentials, per OAuth 2.1 §2.3.1. */
function basicAuthCredentials(request: Request): { clientId: string; secret: string } | null {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Basic (.+)$/)
  if (!match) return null
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    if (separator === -1) return null
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      secret: decodeURIComponent(decoded.slice(separator + 1)),
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const params = await readParams(request)
  const basic = basicAuthCredentials(request)

  const clientId = basic?.clientId ?? params.client_id
  const clientSecret = basic?.secret ?? params.client_secret ?? null

  if (!clientId) return fail('invalid_client', 'client_id is required')

  const client = await findClient(clientId)
  if (!client) return fail('invalid_client', 'Unknown client_id', 401)
  if (!clientSecretMatches(client, clientSecret)) {
    return fail('invalid_client', 'Client authentication failed', 401)
  }

  const grantType = params.grant_type
  if (!grantType) return fail('invalid_request', 'grant_type is required')
  if (!client.grantTypes.includes(grantType)) {
    return fail('unauthorized_client', `This client may not use the ${grantType} grant`)
  }

  if (grantType === 'authorization_code') {
    if (!params.code) return fail('invalid_request', 'code is required')
    if (!params.redirect_uri) return fail('invalid_request', 'redirect_uri is required')

    const result = await consumeAuthCode({
      code: params.code,
      clientDbId: client.id,
      redirectUri: params.redirect_uri,
      codeVerifier: params.code_verifier ?? null,
      resource: params.resource ?? null,
    })
    if ('error' in result) return fail(result.error.error, result.error.error_description)

    const tokens = await issueTokenPair({
      clientDbId: client.id,
      userId: result.code.userId,
      scope: result.code.scope,
      resource: result.code.resource,
    })
    return NextResponse.json(tokens, { headers: { ...CORS, ...NO_STORE } })
  }

  if (grantType === 'refresh_token') {
    if (!params.refresh_token) return fail('invalid_request', 'refresh_token is required')

    const result = await rotateRefreshToken({
      refreshToken: params.refresh_token,
      clientDbId: client.id,
      scope: params.scope ?? null,
      resource: params.resource ?? null,
    })
    if ('error' in result) return fail(result.error.error, result.error.error_description)

    return NextResponse.json(result.tokens, { headers: { ...CORS, ...NO_STORE } })
  }

  return fail('unsupported_grant_type', `Unsupported grant_type: ${grantType}`)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
