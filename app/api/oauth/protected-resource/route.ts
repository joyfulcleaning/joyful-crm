export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { protectedResourceMetadata } from '@/lib/oauth'

/**
 * RFC 9728 Protected Resource Metadata. Served at
 * /.well-known/oauth-protected-resource (and the path-insertion variants) via
 * rewrites in next.config.ts — a literal `app/.well-known/` directory is not
 * a reliable route segment, since the leading dot is treated as hidden.
 *
 * This is the entry point of the whole flow: ChatGPT reads it to discover
 * which authorization server issues tokens for the MCP endpoint.
 */

// Public, unauthenticated discovery document — wildcard CORS is intentional so
// browser-based MCP clients (e.g. the MCP Inspector) can read it too.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
}

export async function GET(request: Request) {
  return NextResponse.json(protectedResourceMetadata(request), {
    headers: { ...CORS, 'Cache-Control': 'public, max-age=3600' },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
