/**
 * Regression tests for how POST /api/oauth/authorize routes the consent
 * decision (P1.3): approve, deny, absent action, and unrecognized action must
 * each produce a different, truthful outcome.
 *
 *   npx next start -p 3002          # in another terminal, from a fresh build
 *   npx ts-node scripts/test-consent-action-routing.ts http://localhost:3002
 *
 * These write nothing to the database. Consent tickets are signed locally with
 * the same NEXTAUTH_SECRET the server uses, and the approve case is sent
 * WITHOUT a session cookie: the handler then stops at the session check, which
 * proves it took the approve branch without ever reaching issueAuthCode().
 * That keeps the "approve" path observable without minting a real grant.
 */
import 'dotenv/config'
import { signConsentTicket } from '../lib/oauth'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '')
const REDIRECT_URI = 'https://chatgpt.com/connector/oauth/routing-test'
const STATE = 'state-value-to-preserve'

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}`)
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`)
  }
}

function ticket(withState = true) {
  return signConsentTicket({
    clientDbId: '00000000-0000-0000-0000-000000000000',
    clientName: 'ChatGPT (routing test)',
    redirectUri: REDIRECT_URI,
    codeChallenge: 'not-used-on-these-paths',
    scope: 'crm.read crm.write',
    resource: `${BASE}/api/assistant/mcp`,
    state: withState ? STATE : null,
  })
}

type Outcome = {
  status: number
  location: string | null
  error: string | null
  description: string | null
  state: string | null
  code: string | null
  body: string
}

async function post(fields: Record<string, string>, withState = true): Promise<Outcome> {
  const body = new URLSearchParams({ ticket: ticket(withState), ...fields })
  const res = await fetch(`${BASE}/api/oauth/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })

  const location = res.headers.get('location')
  const url = location ? new URL(location) : null
  return {
    status: res.status,
    location,
    error: url?.searchParams.get('error') ?? null,
    description: url?.searchParams.get('error_description') ?? null,
    state: url?.searchParams.get('state') ?? null,
    code: url?.searchParams.get('code') ?? null,
    body: res.status === 303 ? '' : await res.text(),
  }
}

async function main() {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required to sign test consent tickets (load it from .env)')
  }

  console.log('\n— action=approve (no session: must reach the session check, not a denial) —')
  const approve = await post({ action: 'approve', scope: 'crm.read' })
  check('redirects 303', approve.status === 303, approve.status)
  check('reached the approve branch (stopped at the session check)',
    approve.description?.includes('Session expired') === true, approve.description)
  check('did NOT report a denial by the administrator',
    approve.description?.includes('declined') !== true, approve.description)
  check('issued no authorization code', approve.code === null, approve.code)
  check('preserved state', approve.state === STATE, approve.state)
  check('redirected only to the ticket redirect_uri',
    approve.location?.startsWith(REDIRECT_URI) === true, approve.location)

  console.log('\n— action=deny —')
  const deny = await post({ action: 'deny' })
  check('redirects 303', deny.status === 303, deny.status)
  check('error is access_denied', deny.error === 'access_denied', deny.error)
  check('says the administrator declined',
    deny.description?.includes('declined') === true, deny.description)
  check('issued no authorization code', deny.code === null, deny.code)
  check('preserved state', deny.state === STATE, deny.state)
  check('redirected only to the ticket redirect_uri',
    deny.location?.startsWith(REDIRECT_URI) === true, deny.location)

  console.log('\n— action absent —')
  const absent = await post({})
  check('redirects 303', absent.status === 303, absent.status)
  check('error is invalid_request', absent.error === 'invalid_request', absent.error)
  check('does NOT masquerade as access_denied', absent.error !== 'access_denied', absent.error)
  check('message names the real problem',
    absent.description?.toLowerCase().includes('no consent decision') === true, absent.description)
  check('issued no authorization code', absent.code === null, absent.code)
  check('preserved state', absent.state === STATE, absent.state)
  check('redirected only to the ticket redirect_uri',
    absent.location?.startsWith(REDIRECT_URI) === true, absent.location)

  console.log('\n— action is an empty string (the old form\'s failure shape) —')
  const empty = await post({ action: '' })
  check('treated as absent, not as a denial', empty.error === 'invalid_request', empty.error)
  check('message names the real problem',
    empty.description?.toLowerCase().includes('no consent decision') === true, empty.description)
  check('issued no authorization code', empty.code === null, empty.code)

  console.log('\n— action is an unrecognized value —')
  const bogus = await post({ action: 'approve_please' })
  check('redirects 303', bogus.status === 303, bogus.status)
  check('error is invalid_request', bogus.error === 'invalid_request', bogus.error)
  check('message says it was not recognized',
    bogus.description?.toLowerCase().includes('not recognized') === true, bogus.description)
  check('issued no authorization code', bogus.code === null, bogus.code)
  check('preserved state', bogus.state === STATE, bogus.state)

  console.log('\n— the four outcomes are mutually distinguishable —')
  const outcomes = {
    approve: `${approve.error}|${approve.description}`,
    deny: `${deny.error}|${deny.description}`,
    absent: `${absent.error}|${absent.description}`,
    bogus: `${bogus.error}|${bogus.description}`,
  }
  check('approve differs from deny', outcomes.approve !== outcomes.deny, outcomes)
  check('absent differs from deny', outcomes.absent !== outcomes.deny, outcomes)
  check('absent differs from approve', outcomes.absent !== outcomes.approve, outcomes)
  check('unrecognized differs from absent', outcomes.bogus !== outcomes.absent, outcomes)
  check('only deny uses access_denied for a real refusal',
    deny.error === 'access_denied' && absent.error === 'invalid_request' && bogus.error === 'invalid_request', outcomes)

  console.log('\n— state handling —')
  const noState = await post({ action: 'deny' }, false)
  check('omits state when the request had none', noState.state === null, noState.state)
  check('still redirects to the validated URI',
    noState.location?.startsWith(REDIRECT_URI) === true, noState.location)

  console.log('\n— ticket validation is unchanged —')
  const noTicket = await fetch(`${BASE}/api/oauth/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ action: 'approve' }),
    redirect: 'manual',
  })
  check('missing ticket is a 400, never a redirect', noTicket.status === 400, noTicket.status)

  const tampered = await fetch(`${BASE}/api/oauth/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ticket: `${ticket()}tampered`, action: 'approve' }),
    redirect: 'manual',
  })
  check('tampered ticket is a 400, never a redirect', tampered.status === 400, tampered.status)

  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\nTest run crashed:', err)
  process.exit(1)
})
