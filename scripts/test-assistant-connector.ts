/**
 * End-to-end check of the ChatGPT connector flow (OAuth 2.1 + MCP).
 *
 *   npx ts-node scripts/test-assistant-connector.ts [baseUrl]
 *
 * Defaults to http://localhost:3000. The base URL must match NEXTAUTH_URL on
 * the server being tested, since that is what the server uses as its OAuth
 * issuer and token audience.
 *
 * Covers everything except clicking the consent screen: that step is simulated
 * by inserting an authorization code directly, exactly as the approve handler
 * does, so the PKCE exchange and audience binding are still exercised for real.
 *
 * Creates one throwaway OAuth client and deletes it (and its tokens) at the
 * end. It reads real CRM data but writes nothing outside the oauth_* tables.
 */
import { createHash, randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '')
const TEST_CLIENT_NAME = 'ChatGPT (test)'
const prisma = new PrismaClient()

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sha256 = (s: string) => createHash('sha256').update(s).digest()

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}`)
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail).slice(0, 400)}`)
  }
}

async function main() {
  console.log('\n— Discovery —')

  const prm = await fetch(`${BASE}/.well-known/oauth-protected-resource`)
  const prmBody = await prm.json()
  check('protected-resource metadata is 200', prm.status === 200, prm.status)
  check('advertises the MCP resource', prmBody.resource?.endsWith('/api/assistant/mcp'), prmBody)
  check('names an authorization server', Array.isArray(prmBody.authorization_servers) && prmBody.authorization_servers.length > 0, prmBody)

  const asm = await fetch(`${BASE}/.well-known/oauth-authorization-server`)
  const asmBody = await asm.json()
  check('authorization-server metadata is 200', asm.status === 200, asm.status)
  check('S256 only (no plain PKCE)', JSON.stringify(asmBody.code_challenge_methods_supported) === '["S256"]', asmBody.code_challenge_methods_supported)
  check('exposes registration endpoint', typeof asmBody.registration_endpoint === 'string', asmBody)

  console.log('\n— Unauthenticated MCP access —')

  const unauth = await fetch(`${BASE}/api/assistant/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })
  check('rejects with 401', unauth.status === 401, unauth.status)
  const wwwAuth = unauth.headers.get('www-authenticate') ?? ''
  check('WWW-Authenticate points at resource metadata', wwwAuth.includes('resource_metadata='), wwwAuth)

  const getStream = await fetch(`${BASE}/api/assistant/mcp`)
  check('GET declines the SSE stream with 405', getStream.status === 405, getStream.status)

  console.log('\n— Dynamic client registration —')

  const redirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect'
  const reg = await fetch(`${BASE}/api/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: TEST_CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
    }),
  })
  const regBody = await reg.json()
  check('registration returns 201', reg.status === 201, regBody)
  check('issues a client_id', typeof regBody.client_id === 'string', regBody)
  check('public client gets no secret', regBody.client_secret === undefined, regBody)

  const badReg = await fetch(`${BASE}/api/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'bad', redirect_uris: ['http://evil.example.com/cb'] }),
  })
  check('rejects non-HTTPS redirect_uri', badReg.status === 400, badReg.status)

  console.log('\n— Consent screen —')

  const consent = await fetch(
    `${BASE}/oauth/authorize?client_id=${regBody.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&code_challenge=abc&code_challenge_method=S256`,
    { redirect: 'manual' }
  )
  check('redirects anonymous visitor to login', [307, 302, 303].includes(consent.status), consent.status)
  check('preserves the request in callbackUrl', (consent.headers.get('location') ?? '').includes('callbackUrl'), consent.headers.get('location'))

  const badClient = await fetch(`${BASE}/oauth/authorize?client_id=nope&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`)
  const badClientHtml = await badClient.text()
  check('unknown client_id is shown, never redirected', badClientHtml.includes('Unknown client'), badClient.status)

  console.log('\n— Authorization code exchange (PKCE) —')

  const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No active admin user to authorize as')

  const client = await prisma.oAuthClient.findUnique({ where: { clientId: regBody.client_id } })
  if (!client) throw new Error('Registered client missing from the database')

  const verifier = b64url(randomBytes(32))
  const challenge = b64url(sha256(verifier))
  const resource = `${BASE}/api/assistant/mcp`

  async function freshCode(scope: string) {
    const code = b64url(randomBytes(32))
    await prisma.oAuthAuthCode.create({
      data: {
        codeHash: sha256(code).toString('hex'),
        clientId: client!.id,
        userId: admin!.id,
        redirectUri,
        codeChallenge: challenge,
        scope,
        resource,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    return code
  }

  const wrongVerifier = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: await freshCode('crm.read crm.write'),
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: b64url(randomBytes(32)),
      resource,
    }),
  })
  check('wrong code_verifier is rejected', wrongVerifier.status === 400, await wrongVerifier.json())

  const code = await freshCode('crm.read crm.write')
  const tokenRes = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: verifier,
      resource,
    }),
  })
  const tokens = await tokenRes.json()
  check('token exchange succeeds', tokenRes.status === 200, tokens)
  check('returns a bearer access token', typeof tokens.access_token === 'string' && tokens.token_type === 'Bearer', tokens)
  check('returns a refresh token', typeof tokens.refresh_token === 'string', tokens)

  console.log('\n— MCP protocol —')

  const access = tokens.access_token
  const rpc = async (method: string, params?: unknown, token = access) => {
    const res = await fetch(`${BASE}/api/assistant/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, params }),
    })
    return { status: res.status, body: await res.json() }
  }

  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
  check('initialize succeeds', init.status === 200 && !!init.body.result, init.body)
  check('negotiates the requested protocol version', init.body.result?.protocolVersion === '2025-06-18', init.body.result)
  check('returns instructions for the model', typeof init.body.result?.instructions === 'string', Object.keys(init.body.result ?? {}))

  const toolsList = await rpc('tools/list')
  const tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> = toolsList.body.result?.tools ?? []
  check('tools/list returns the catalog', tools.length > 15, tools.length)
  check('search + fetch present for deep research', tools.some(t => t.name === 'search') && tools.some(t => t.name === 'fetch'), tools.map(t => t.name))
  check('reads are annotated readOnlyHint', tools.find(t => t.name === 'list_services')?.annotations?.readOnlyHint === true)
  check('writes are not annotated readOnlyHint', tools.find(t => t.name === 'create_service')?.annotations?.readOnlyHint === false)

  const today = await rpc('tools/call', { name: 'get_today', arguments: {} })
  const todayData = JSON.parse(today.body.result?.content?.[0]?.text ?? '{}')
  check('get_today returns a real date', /^\d{4}-\d{2}-\d{2}$/.test(todayData.date), todayData)

  const summary = await rpc('tools/call', { name: 'business_summary', arguments: { period: 'this_week' } })
  const summaryData = JSON.parse(summary.body.result?.content?.[0]?.text ?? '{}')
  check('business_summary resolves this_week server-side', !!summaryData.range?.from && !!summaryData.range?.to, summaryData.range)
  check('business_summary separates cash from service value', summaryData.cash !== undefined && summaryData.services !== undefined, Object.keys(summaryData))

  const badPeriod = await rpc('tools/call', { name: 'business_summary', arguments: { period: 'last_fortnight' } })
  check('unknown period is a tool error, not a protocol error', badPeriod.body.result?.isError === true, badPeriod.body)

  const services = await rpc('tools/call', { name: 'list_services', arguments: { period: 'this_month', limit: 3 } })
  const servicesData = JSON.parse(services.body.result?.content?.[0]?.text ?? '{}')
  check('list_services returns rows with a range', Array.isArray(servicesData.services) && !!servicesData.range, Object.keys(servicesData))

  const confirmNeeded = await rpc('tools/call', {
    name: 'adjust_inventory',
    arguments: { productId: 'does-not-exist', type: 'out', quantity: 1 },
  })
  check('adjust_inventory rejects an unknown product', confirmNeeded.body.result?.isError === true, confirmNeeded.body.result)

  const missingArg = await rpc('tools/call', { name: 'get_client', arguments: {} })
  check('missing required arg is reported as a tool error', missingArg.body.result?.isError === true, missingArg.body.result)

  const unknownTool = await rpc('tools/call', { name: 'drop_everything', arguments: {} })
  check('unknown tool is refused', unknownTool.body.result?.isError === true, unknownTool.body.result)

  console.log('\n— Confirmation gating on consequential writes —')

  // These call the real write tools against real records but deliberately omit
  // `confirm`, so they must come back with a preview and change nothing. The
  // stock/balance assertions afterwards prove nothing was written.
  const product = await prisma.inventoryProduct.findFirst({
    where: { currentStock: { gt: 0 } },
    select: { id: true, name: true, currentStock: true },
  })
  if (product) {
    const preview = await rpc('tools/call', {
      name: 'adjust_inventory',
      arguments: { productId: product.id, type: 'out', quantity: 1 },
    })
    const previewData = JSON.parse(preview.body.result?.content?.[0]?.text ?? '{}')
    check('adjust_inventory asks for confirmation first', previewData.confirmationRequired === true, previewData)
    check('confirmation preview shows the resulting stock', previewData.preview?.stockAfter === product.currentStock - 1, previewData.preview)

    const after = await prisma.inventoryProduct.findUnique({
      where: { id: product.id },
      select: { currentStock: true },
    })
    check('stock unchanged while awaiting confirmation', after?.currentStock === product.currentStock, {
      before: product.currentStock,
      after: after?.currentStock,
    })
  } else {
    console.log('  skip  no product with stock on hand to preview against')
  }

  const invoice = await prisma.invoice.findFirst({
    where: { balanceDue: { gt: 0 } },
    select: { id: true, invoiceNumber: true, amountPaid: true, balanceDue: true },
  })
  if (invoice) {
    const preview = await rpc('tools/call', {
      name: 'record_invoice_payment',
      arguments: { invoiceId: invoice.id, amount: 1, method: 'cash' },
    })
    const previewData = JSON.parse(preview.body.result?.content?.[0]?.text ?? '{}')
    check('record_invoice_payment asks for confirmation first', previewData.confirmationRequired === true, previewData)
    check('preview shows the balance that would remain', typeof previewData.preview?.balanceAfter === 'number', previewData.preview)

    const after = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      select: { amountPaid: true },
    })
    check('invoice untouched while awaiting confirmation', Number(after?.amountPaid) === Number(invoice.amountPaid), {
      before: Number(invoice.amountPaid),
      after: Number(after?.amountPaid),
    })

    const overpay = await rpc('tools/call', {
      name: 'record_invoice_payment',
      arguments: { invoiceId: invoice.id, amount: Number(invoice.balanceDue) + 500, method: 'cash', confirm: true },
    })
    check('overpayment is refused even with confirm', overpay.body.result?.isError === true, overpay.body.result?.content?.[0]?.text?.slice(0, 160))
  } else {
    console.log('  skip  no invoice with a balance to preview against')
  }

  const cancelPreview = await rpc('tools/call', {
    name: 'update_service',
    arguments: { serviceId: 'does-not-exist', status: 'cancelled' },
  })
  check('cancelling an unknown service is refused', cancelPreview.body.result?.isError === true, cancelPreview.body.result)

  const realService = await prisma.service.findFirst({
    where: { status: { in: ['pending', 'completed'] } },
    select: { id: true, status: true },
  })
  if (realService) {
    const preview = await rpc('tools/call', {
      name: 'update_service',
      arguments: { serviceId: realService.id, status: 'cancelled' },
    })
    const previewData = JSON.parse(preview.body.result?.content?.[0]?.text ?? '{}')
    check('cancelling a service asks for confirmation first', previewData.confirmationRequired === true, previewData)

    const after = await prisma.service.findUnique({ where: { id: realService.id }, select: { status: true } })
    check('service status unchanged while awaiting confirmation', after?.status === realService.status, {
      before: realService.status,
      after: after?.status,
    })
  } else {
    console.log('  skip  no service available to preview a cancellation against')
  }

  console.log('\n— Read-only scope enforcement —')

  const roCode = await freshCode('crm.read')
  const roTokenRes = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: roCode,
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: verifier,
      resource,
    }),
  })
  const roTokens = await roTokenRes.json()
  check('read-only token issued', roTokenRes.status === 200 && roTokens.scope === 'crm.read', roTokens)

  const roList = await rpc('tools/list', undefined, roTokens.access_token)
  const roNames: string[] = (roList.body.result?.tools ?? []).map((t: { name: string }) => t.name)
  check('write tools hidden from a read-only token', !roNames.includes('create_service'), roNames)

  const roWrite = await rpc(
    'tools/call',
    { name: 'create_service', arguments: { clientId: 'x', serviceDate: '2026-11-02', serviceTime: '09:00', type: 'Standard Clean' } },
    roTokens.access_token
  )
  const roWriteText = roWrite.body.result?.content?.[0]?.text ?? ''
  check('write call refused even if the client asks anyway', roWrite.body.result?.isError === true && roWriteText.includes('read-only'), roWriteText.slice(0, 200))

  console.log('\n— Refresh token rotation —')

  const refresh1 = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: regBody.client_id,
      resource,
    }),
  })
  const refreshed = await refresh1.json()
  check('refresh returns a new pair', refresh1.status === 200 && !!refreshed.access_token, refreshed)
  check('refresh token is rotated', refreshed.refresh_token !== tokens.refresh_token)

  const reuse = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: regBody.client_id,
      resource,
    }),
  })
  check('reusing a rotated refresh token is rejected', reuse.status === 400, await reuse.json())

  const afterBreach = await rpc('tools/call', { name: 'get_today', arguments: {} }, refreshed.access_token)
  check('token family revoked after replay detection', afterBreach.status === 401, afterBreach.status)

  console.log('\n— SSE framing —')

  const sseCode = await freshCode('crm.read')
  const sseTokenRes = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: sseCode,
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: verifier,
      resource,
    }),
  })
  const sseTokens = await sseTokenRes.json()

  const sse = await fetch(`${BASE}/api/assistant/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${sseTokens.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
  })
  const sseText = await sse.text()
  check('SSE-only client gets event-stream framing', (sse.headers.get('content-type') ?? '').includes('text/event-stream'), sse.headers.get('content-type'))
  check('SSE payload carries the JSON-RPC response', sseText.startsWith('event: message') && sseText.includes('"tools"'), sseText.slice(0, 120))

  // The spec requires clients to advertise both types, so the common case must
  // come back as plain JSON rather than a stream.
  const bothAccept = await fetch(`${BASE}/api/assistant/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${sseTokens.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'ping' }),
  })
  check(
    'client accepting both gets plain JSON',
    (bothAccept.headers.get('content-type') ?? '').includes('application/json'),
    bothAccept.headers.get('content-type')
  )

  const notif = await fetch(`${BASE}/api/assistant/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sseTokens.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  })
  check('notification gets 202 with no body', notif.status === 202, notif.status)

  const badVersion = await fetch(`${BASE}/api/assistant/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sseTokens.access_token}`,
      'MCP-Protocol-Version': '1999-01-01',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
  })
  check('unsupported MCP-Protocol-Version is 400', badVersion.status === 400, badVersion.status)

  // Last, because replay detection deliberately revokes every live token for
  // this client+user — running it earlier would cut off the tests above.
  console.log('\n— Authorization code replay —')

  const replayCode = await freshCode('crm.read')
  const firstUse = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: replayCode,
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: verifier,
      resource,
    }),
  })
  const firstUseTokens = await firstUse.json()
  check('first use of the code succeeds', firstUse.status === 200, firstUseTokens)

  const replay = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: replayCode,
      redirect_uri: redirectUri,
      client_id: regBody.client_id,
      code_verifier: verifier,
      resource,
    }),
  })
  check('replayed code is rejected', replay.status === 400, await replay.json())

  const afterReplay = await rpc('tools/call', { name: 'get_today', arguments: {} }, firstUseTokens.access_token)
  check('replay revokes the token issued from that code', afterReplay.status === 401, afterReplay.status)

  console.log('\n— Audit trail —')

  const auditCount = await prisma.auditLog.count({
    where: { entity: 'oauth_grant' },
  })
  console.log(`  info  oauth_grant audit rows: ${auditCount}`)

  // Clean up everything this run created.
  await prisma.oAuthClient.delete({ where: { id: client.id } })
  console.log('  info  test client and its tokens deleted')

  console.log(`\n${pass} passed, ${fail} failed\n`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async err => {
  console.error('\nTest run crashed:', err)
  // Clean up even on failure — otherwise a crash mid-run leaves a live OAuth
  // client (and its tokens) sitting in the database.
  try {
    const removed = await prisma.oAuthClient.deleteMany({ where: { name: TEST_CLIENT_NAME } })
    console.error(`Cleaned up ${removed.count} test client(s).`)
  } catch (cleanupError) {
    console.error('Cleanup also failed:', cleanupError)
  }
  await prisma.$disconnect()
  process.exit(1)
})
