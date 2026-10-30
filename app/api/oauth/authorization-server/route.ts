export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { authorizationServerMetadata } from '@/lib/oauth'

/**
 * RFC 8414 Authorization Server Metadata, reached through the
 * /.well-known/oauth-authorization-server rewrite. Also answers
 * /.well-known/openid-configuration, which some clients probe first even when
 * the server is plain OAuth with no OIDC surface.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
}

export async function GET(request: Request) {
  return NextResponse.json(authorizationServerMetadata(request), {
    headers: { ...CORS, 'Cache-Control': 'public, max-age=3600' },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
