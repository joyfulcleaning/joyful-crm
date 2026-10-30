export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { SCOPE_READ, issueAuthCode, normalizeScope, verifyConsentTicket } from '@/lib/oauth'

/**
 * Approval half of the authorization endpoint — the POST target of the consent
 * screen at /oauth/authorize.
 *
 * The authorization parameters arrive as a signed ticket rather than raw form
 * fields, so this handler cannot be tricked into minting a code for a
 * redirect_uri the consent page never validated or displayed. The session is
 * re-checked here too: the ticket proves which request was approved, not who
 * is approving it.
 */
export async function POST(request: Request) {
  const form = await request.formData()
  const ticketRaw = form.get('ticket')
  const action = form.get('action')

  if (typeof ticketRaw !== 'string') {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Missing consent ticket' }, { status: 400 })
  }

  const ticket = verifyConsentTicket(ticketRaw)
  if (!ticket) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Consent ticket is invalid or expired. Start the connection again.' },
      { status: 400 }
    )
  }

  // Safe to redirect from here on: this URI came out of the signed ticket, so
  // the consent page already matched it against the client's registered URIs.
  const redirect = new URL(ticket.redirectUri)
  if (ticket.state) redirect.searchParams.set('state', ticket.state)

  const bounce = (error: string, description: string) => {
    redirect.searchParams.set('error', error)
    redirect.searchParams.set('error_description', description)
    return NextResponse.redirect(redirect.toString(), { status: 303 })
  }

  // Three distinct outcomes. Collapsing "no action" into "denied" is what made
  // the original consent-form defect so hard to diagnose: the form silently
  // stopped sending `action`, and ChatGPT reported a cancellation that nobody
  // had performed. An absent or unrecognized action is a fault on our side and
  // now says so, which also keeps a real denial honest.
  const missingAction = action === null || (typeof action === 'string' && action.trim() === '')
  if (missingAction) {
    console.error('[oauth/authorize] consent POST carried no action — the consent form is not submitting it')
    return bounce('invalid_request', 'No consent decision was submitted. Please start the authorization again.')
  }

  if (action !== 'approve' && action !== 'deny') {
    console.error(`[oauth/authorize] unrecognized consent action: ${String(action)}`)
    return bounce('invalid_request', 'The consent decision was not recognized. Please start the authorization again.')
  }

  if (action === 'deny') {
    return bounce('access_denied', 'The administrator declined the request')
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } })
    : null

  if (!user || user.status !== 'active' || user.role !== 'admin') {
    return bounce('access_denied', 'Session expired or not an active admin')
  }

  // The checkbox may narrow the grant to read-only, but can never widen it
  // beyond what the signed ticket authorized.
  const requested = normalizeScope(typeof form.get('scope') === 'string' ? (form.get('scope') as string) : null)
  const ticketScopes = new Set(ticket.scope.split(/\s+/))
  const granted = requested.split(/\s+/).filter(s => ticketScopes.has(s))
  const scope = granted.length > 0 ? granted.join(' ') : SCOPE_READ

  const code = await issueAuthCode({
    clientId: ticket.clientDbId,
    userId: user.id,
    redirectUri: ticket.redirectUri,
    codeChallenge: ticket.codeChallenge,
    scope,
    resource: ticket.resource,
  })

  await logAudit({ id: user.id, role: 'admin', name: user.name }, 'create', 'oauth_grant', ticket.clientDbId, {
    client: ticket.clientName,
    scope,
    resource: ticket.resource,
  })

  redirect.searchParams.set('code', code)
  return NextResponse.redirect(redirect.toString(), { status: 303 })
}
