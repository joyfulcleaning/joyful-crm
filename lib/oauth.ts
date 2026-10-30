import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'
import type { AuthUser } from './mobile-auth'

/**
 * OAuth 2.1 authorization server backing the MCP connector at
 * /api/assistant/mcp.
 *
 * This exists because ChatGPT will not talk to an MCP server authenticated by
 * a shared API key — it requires an OAuth 2.1 flow per the MCP authorization
 * spec (protected resource metadata, PKCE, dynamic client registration,
 * RFC 8707 resource indicators). Everything here is the minimum subset of
 * those RFCs needed for that, nothing more:
 *
 *   - RFC 9728  Protected Resource Metadata  → /.well-known/oauth-protected-resource
 *   - RFC 8414  Authorization Server Metadata → /.well-known/oauth-authorization-server
 *   - RFC 7591  Dynamic Client Registration   → /api/oauth/register
 *   - RFC 8707  Resource Indicators           → `resource` on authorize + token
 *   - OAuth 2.1 Authorization code + PKCE S256, rotating refresh tokens
 *
 * The resource owner is always an existing admin User: the consent screen runs
 * behind the normal NextAuth session, so no new identity is introduced.
 */

export const SCOPE_READ = 'crm.read'
export const SCOPE_WRITE = 'crm.write'
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE]

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000 // 1h — short-lived, per spec guidance
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000 // 60d
const AUTH_CODE_TTL_MS = 60 * 1000 // 1 min; redeemed immediately in practice

export const MCP_PATH = '/api/assistant/mcp'

/**
 * Stable external origin. Taken from NEXTAUTH_URL rather than the request host
 * because the `issuer` and `resource` identifiers must be byte-identical
 * across discovery, authorization and token validation — on Vercel the Host
 * header varies between the production domain and per-deployment URLs.
 */
export function baseUrl(request?: Request): string {
  const configured = process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (request) return new URL(request.url).origin
  return ''
}

/** Canonical MCP server URI used as the OAuth audience (RFC 8707 §2). */
export function mcpResourceUrl(request?: Request): string {
  return `${baseUrl(request)}${MCP_PATH}`
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomSecret(): string {
  return base64url(randomBytes(32))
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function hashToken(token: string): string {
  return sha256(token).toString('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ─────────────────────────────────────────────
// Metadata documents
// ─────────────────────────────────────────────

export function protectedResourceMetadata(request: Request) {
  const base = baseUrl(request)
  return {
    resource: mcpResourceUrl(request),
    authorization_servers: [base],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Joyful CRM',
    resource_documentation: `${base}/docs/assistant`,
  }
}

export function authorizationServerMetadata(request: Request) {
  const base = baseUrl(request)
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: SUPPORTED_SCOPES,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    // S256 only. OAuth 2.1 forbids "plain", and advertising it would let a
    // client downgrade the one protection a public client has.
    code_challenge_methods_supported: ['S256'],
    resource_indicators_supported: true,
  }
}

/**
 * RFC 9728 §5.1 — tells an unauthenticated MCP client where to start discovery.
 * Without this header ChatGPT cannot find the authorization server at all.
 */
export function wwwAuthenticateHeader(request: Request, error?: string, description?: string): string {
  const parts = [
    `Bearer realm="Joyful CRM"`,
    `resource_metadata="${baseUrl(request)}/.well-known/oauth-protected-resource"`,
  ]
  if (error) parts.push(`error="${error}"`)
  if (description) parts.push(`error_description="${description}"`)
  return parts.join(', ')
}

// ─────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────

export type RegistrationRequest = {
  redirect_uris?: unknown
  client_name?: unknown
  grant_types?: unknown
  response_types?: unknown
  token_endpoint_auth_method?: unknown
  scope?: unknown
}

export type RegistrationError = { error: string; error_description: string }

/**
 * Redirect URIs must be exact-matched later, so they are validated strictly
 * here: HTTPS only, except loopback (which MCP clients running locally need).
 * Anything with a fragment is rejected — OAuth forbids it and it would break
 * exact comparison.
 */
function isValidRedirectUri(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.hash) return false
  if (url.protocol === 'https:') return true
  const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  return url.protocol === 'http:' && isLoopback
}

export async function registerClient(body: RegistrationRequest) {
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === 'string')
    : []

  if (redirectUris.length === 0) {
    return {
      error: {
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uris is required and must contain at least one URI',
      } satisfies RegistrationError,
    }
  }

  const invalid = redirectUris.find(u => !isValidRedirectUri(u))
  if (invalid) {
    return {
      error: {
        error: 'invalid_redirect_uri',
        error_description: `redirect_uri must be https (or http on loopback) with no fragment: ${invalid}`,
      } satisfies RegistrationError,
    }
  }

  const authMethod = typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none'
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(authMethod)) {
    return {
      error: {
        error: 'invalid_client_metadata',
        error_description: `Unsupported token_endpoint_auth_method: ${authMethod}`,
      } satisfies RegistrationError,
    }
  }

  const requestedGrants = Array.isArray(body.grant_types)
    ? body.grant_types.filter((g): g is string => typeof g === 'string')
    : ['authorization_code', 'refresh_token']
  const grantTypes = requestedGrants.filter(g => ['authorization_code', 'refresh_token'].includes(g))
  if (grantTypes.length === 0) {
    return {
      error: {
        error: 'invalid_client_metadata',
        error_description: 'Only authorization_code and refresh_token grants are supported',
      } satisfies RegistrationError,
    }
  }

  const clientId = `joyful-${base64url(randomBytes(16))}`
  const secret = authMethod === 'none' ? null : randomSecret()

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      secretHash: secret ? hashToken(secret) : null,
      name: typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim() : 'MCP client',
      redirectUris,
      grantTypes,
      authMethod,
    },
  })

  return {
    registration: {
      client_id: client.clientId,
      ...(secret ? { client_secret: secret } : {}),
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      response_types: ['code'],
      token_endpoint_auth_method: client.authMethod,
      scope: SUPPORTED_SCOPES.join(' '),
    },
  }
}

export async function findClient(clientId: string) {
  return prisma.oAuthClient.findUnique({ where: { clientId } })
}

/** Confidential clients must prove possession of their secret at /token. */
export function clientSecretMatches(client: { secretHash: string | null }, provided: string | null): boolean {
  if (!client.secretHash) return true // public client — PKCE is the proof
  if (!provided) return false
  return safeEqual(client.secretHash, hashToken(provided))
}

// ─────────────────────────────────────────────
// Scopes
// ─────────────────────────────────────────────

/**
 * Unknown scopes are dropped rather than rejected: ChatGPT may ask for scopes
 * it uses with other servers, and failing the whole authorization over one
 * unrecognized word would be a dead end for the user.
 */
export function normalizeScope(requested: string | null): string {
  if (!requested) return SUPPORTED_SCOPES.join(' ')
  const granted = requested.split(/\s+/).filter(s => SUPPORTED_SCOPES.includes(s))
  return granted.length > 0 ? granted.join(' ') : SCOPE_READ
}

export function scopeAllowsWrite(scope: string): boolean {
  return scope.split(/\s+/).includes(SCOPE_WRITE)
}

// ─────────────────────────────────────────────
// Authorization codes
// ─────────────────────────────────────────────

export async function issueAuthCode(params: {
  clientId: string
  userId: string
  redirectUri: string
  codeChallenge: string
  scope: string
  resource: string | null
}): Promise<string> {
  const code = randomSecret()
  await prisma.oAuthAuthCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scope: params.scope,
      resource: params.resource,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  })
  return code
}

export type TokenError = { error: string; error_description: string }

/**
 * Redeems an authorization code exactly once, verifying PKCE and the exact
 * redirect URI. A code presented twice is treated as a replay: the first use
 * already stamped consumedAt, so every later attempt fails.
 */
export async function consumeAuthCode(params: {
  code: string
  clientDbId: string
  redirectUri: string
  codeVerifier: string | null
  resource: string | null
}): Promise<{ error: TokenError } | { code: { userId: string; scope: string; resource: string | null } }> {
  const record = await prisma.oAuthAuthCode.findUnique({ where: { codeHash: hashToken(params.code) } })

  if (!record || record.clientId !== params.clientDbId) {
    return { error: { error: 'invalid_grant', error_description: 'Authorization code not found' } }
  }
  if (record.consumedAt) {
    // Replayed code — the legitimate client already exchanged it, so someone
    // else has a copy. We cannot tell which of the two callers is the attacker,
    // and the code record does not track which tokens it produced, so the safe
    // response is to drop every live token for this client+user (OAuth 2.1
    // §7.5). The admin reconnects from ChatGPT and gets a clean grant.
    await prisma.oAuthToken.updateMany({
      where: { userId: record.userId, clientId: record.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { error: { error: 'invalid_grant', error_description: 'Authorization code already used' } }
  }
  if (record.expiresAt < new Date()) {
    return { error: { error: 'invalid_grant', error_description: 'Authorization code expired' } }
  }
  if (record.redirectUri !== params.redirectUri) {
    return { error: { error: 'invalid_grant', error_description: 'redirect_uri does not match the authorization request' } }
  }
  if (!params.codeVerifier) {
    return { error: { error: 'invalid_request', error_description: 'code_verifier is required' } }
  }

  const challenge = base64url(sha256(params.codeVerifier))
  if (!safeEqual(challenge, record.codeChallenge)) {
    return { error: { error: 'invalid_grant', error_description: 'PKCE verification failed' } }
  }

  // RFC 8707: if the token request names a resource, it must be the one the
  // code was issued for — otherwise the token would carry the wrong audience.
  if (params.resource && record.resource && params.resource !== record.resource) {
    return { error: { error: 'invalid_target', error_description: 'resource does not match the authorization request' } }
  }

  await prisma.oAuthAuthCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } })

  return { code: { userId: record.userId, scope: record.scope, resource: record.resource ?? params.resource } }
}

// ─────────────────────────────────────────────
// Access / refresh tokens
// ─────────────────────────────────────────────

export async function issueTokenPair(params: {
  clientDbId: string
  userId: string
  scope: string
  resource: string | null
}) {
  const accessToken = randomSecret()
  const refreshToken = randomSecret()
  const now = Date.now()

  await prisma.oAuthToken.createMany({
    data: [
      {
        tokenHash: hashToken(accessToken),
        kind: 'access',
        clientId: params.clientDbId,
        userId: params.userId,
        scope: params.scope,
        resource: params.resource,
        expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      },
      {
        tokenHash: hashToken(refreshToken),
        kind: 'refresh',
        clientId: params.clientDbId,
        userId: params.userId,
        scope: params.scope,
        resource: params.resource,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
      },
    ],
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: params.scope,
  }
}

/**
 * Refresh token rotation is mandatory for public clients (OAuth 2.1 §4.3.1):
 * each refresh burns the old token. Reuse of an already-rotated token means it
 * leaked, so the entire token family for that client+user is revoked.
 */
export async function rotateRefreshToken(params: {
  refreshToken: string
  clientDbId: string
  scope: string | null
  resource: string | null
}): Promise<{ error: TokenError } | { tokens: Awaited<ReturnType<typeof issueTokenPair>> }> {
  const record = await prisma.oAuthToken.findUnique({ where: { tokenHash: hashToken(params.refreshToken) } })

  if (!record || record.kind !== 'refresh' || record.clientId !== params.clientDbId) {
    return { error: { error: 'invalid_grant', error_description: 'Refresh token not found' } }
  }
  if (record.revokedAt || record.replacedById) {
    await prisma.oAuthToken.updateMany({
      where: { userId: record.userId, clientId: record.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { error: { error: 'invalid_grant', error_description: 'Refresh token already used; session revoked' } }
  }
  if (record.expiresAt < new Date()) {
    return { error: { error: 'invalid_grant', error_description: 'Refresh token expired' } }
  }

  // A refresh may narrow the granted scope but never widen it.
  let scope = record.scope
  if (params.scope) {
    const requested = params.scope.split(/\s+/).filter(Boolean)
    const held = new Set(record.scope.split(/\s+/))
    if (requested.some(s => !held.has(s))) {
      return { error: { error: 'invalid_scope', error_description: 'Requested scope exceeds the original grant' } }
    }
    scope = requested.join(' ')
  }

  const tokens = await issueTokenPair({
    clientDbId: record.clientId,
    userId: record.userId,
    scope,
    resource: params.resource ?? record.resource,
  })

  const replacement = await prisma.oAuthToken.findUnique({ where: { tokenHash: hashToken(tokens.refresh_token) } })
  await prisma.oAuthToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedById: replacement?.id ?? null },
  })

  return { tokens }
}

// ─────────────────────────────────────────────
// Consent tickets
// ─────────────────────────────────────────────

export type ConsentTicket = {
  clientDbId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  scope: string
  resource: string | null
  state: string | null
  exp: number
}

const CONSENT_TTL_MS = 10 * 60 * 1000

function consentKey(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required to sign consent tickets')
  return secret
}

/**
 * The consent screen validates the authorization request, then hands the POST
 * handler this signed blob instead of re-reading the query string. That way the
 * approval can only ever apply to parameters this server already checked and
 * actually displayed to the admin — a forged POST carrying someone else's
 * redirect_uri has no valid signature.
 */
export function signConsentTicket(payload: Omit<ConsentTicket, 'exp'>): string {
  const body = base64url(Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + CONSENT_TTL_MS })))
  const mac = base64url(createHash('sha256').update(`${body}.${consentKey()}`).digest())
  return `${body}.${mac}`
}

export function verifyConsentTicket(ticket: string): ConsentTicket | null {
  const [body, mac] = ticket.split('.')
  if (!body || !mac) return null

  const expected = base64url(createHash('sha256').update(`${body}.${consentKey()}`).digest())
  if (!safeEqual(expected, mac)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    if (typeof parsed?.exp !== 'number' || parsed.exp < Date.now()) return null
    return parsed as ConsentTicket
  } catch {
    return null
  }
}

export type AssistantPrincipal = {
  user: AuthUser
  scope: string
  clientName: string
  tokenId: string
}

/**
 * Validates a bearer token presented to the MCP endpoint.
 *
 * Audience is checked explicitly: the MCP spec forbids accepting a token that
 * was not issued for this server, and since we are the issuer the check is a
 * comparison against our own canonical resource URI. The user row is re-read
 * every time so a deactivated admin loses access immediately rather than at
 * token expiry, matching getAuthUser() in lib/mobile-auth.ts.
 */
export async function authenticateAssistant(
  request: Request
): Promise<{ error: 'missing' | 'invalid'; description?: string } | { principal: AssistantPrincipal }> {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer (.+)$/)
  if (!match) return { error: 'missing' }

  const record = await prisma.oAuthToken.findUnique({
    where: { tokenHash: hashToken(match[1].trim()) },
    include: { user: { select: { id: true, name: true, role: true, status: true } }, client: { select: { name: true } } },
  })

  if (!record || record.kind !== 'access') {
    return { error: 'invalid', description: 'Access token not recognized' }
  }
  if (record.revokedAt) return { error: 'invalid', description: 'Access token revoked' }
  if (record.expiresAt < new Date()) return { error: 'invalid', description: 'Access token expired' }

  const expectedAudience = mcpResourceUrl(request)
  if (record.resource && record.resource !== expectedAudience) {
    return { error: 'invalid', description: 'Access token was not issued for this resource' }
  }

  if (record.user.status !== 'active') {
    return { error: 'invalid', description: 'User is no longer active' }
  }
  if (record.user.role !== 'admin') {
    return { error: 'invalid', description: 'Assistant access is limited to admin users' }
  }

  // Best-effort activity stamp; never block the request on it.
  prisma.oAuthToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return {
    principal: {
      user: { id: record.user.id, role: 'admin', name: record.user.name },
      scope: record.scope,
      clientName: record.client.name,
      tokenId: record.id,
    },
  }
}

export async function revokeToken(token: string, clientDbId: string): Promise<void> {
  // Revocation is idempotent and must not disclose whether the token existed.
  await prisma.oAuthToken.updateMany({
    where: { tokenHash: hashToken(token), clientId: clientDbId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
