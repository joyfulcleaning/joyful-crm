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

  const redirect = new URL(ticket.redirectUri)
  if (ticket.state) redirect.searchParams.set('state', ticket.state)

  if (action !== 'approve') {
    redirect.searchParams.set('error', 'access_denied')
    redirect.searchParams.set('error_description', 'The administrator declined the request')
    return NextResponse.redirect(redirect.toString(), { status: 303 })
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } })
    : null

  if (!user || user.status !== 'active' || user.role !== 'admin') {
    redirect.searchParams.set('error', 'access_denied')
    redirect.searchParams.set('error_description', 'Session expired or not an active admin')
    return NextResponse.redirect(redirect.toString(), { status: 303 })
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
