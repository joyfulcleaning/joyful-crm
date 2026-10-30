import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  MCP_PATH,
  SCOPE_READ,
  SCOPE_WRITE,
  findClient,
  mcpResourceUrl,
  normalizeScope,
  signConsentTicket,
} from '@/lib/oauth'
import ConsentForm from './ConsentForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Authorize assistant access · Joyful CRM' }

/**
 * OAuth 2.1 authorization endpoint (the browser-facing half).
 *
 * Validates the request, then asks the signed-in admin to approve. Errors are
 * split deliberately: anything wrong with client_id or redirect_uri is shown
 * on this page, because redirecting an unvalidated URI is exactly the open
 * redirect the spec warns about. Everything else is reported back to the
 * client as an OAuth error on its registered redirect URI.
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function ErrorView({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0a0f1a]">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121a2a]/80 p-7">
        <h1 className="text-lg font-bold text-[#f0506e]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#8593a8]">{detail}</p>
        <p className="mt-5 text-xs text-[#5d6b82]">
          Nothing was authorized. You can close this window.
        </p>
      </div>
    </main>
  )
}

export default async function AuthorizePage({ searchParams }: Props) {
  const params = await searchParams

  const clientId = one(params.client_id)
  const redirectUri = one(params.redirect_uri)
  const responseType = one(params.response_type)
  const codeChallenge = one(params.code_challenge)
  const codeChallengeMethod = one(params.code_challenge_method)
  const state = one(params.state)
  const resource = one(params.resource)
  const scope = one(params.scope)

  if (!clientId) {
    return <ErrorView title="Missing client_id" detail="The authorization request did not identify a client." />
  }

  const client = await findClient(clientId)
  if (!client) {
    return (
      <ErrorView
        title="Unknown client"
        detail="This client_id is not registered with Joyful CRM. If you removed and re-added the connector in ChatGPT, start the connection again so it can register afresh."
      />
    )
  }

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return (
      <ErrorView
        title="Invalid redirect_uri"
        detail="The redirect URI does not exactly match one registered by this client, so the request was stopped here rather than redirecting anywhere."
      />
    )
  }

  // From here the redirect URI is trusted, so protocol errors go back to the client.
  const bounce = (error: string, description: string) => {
    const url = new URL(redirectUri)
    url.searchParams.set('error', error)
    url.searchParams.set('error_description', description)
    if (state) url.searchParams.set('state', state)
    redirect(url.toString())
  }

  if (responseType !== 'code') {
    bounce('unsupported_response_type', 'Only response_type=code is supported')
  }
  if (!codeChallenge) {
    bounce('invalid_request', 'code_challenge is required (PKCE)')
  }
  if (codeChallengeMethod !== 'S256') {
    bounce('invalid_request', 'code_challenge_method must be S256')
  }

  // RFC 8707: the token must be bound to this MCP server. A client that names
  // some other resource is misconfigured and would get a token we then refuse.
  const expectedResource = mcpResourceUrl()
  if (resource && resource.replace(/\/+$/, '') !== expectedResource.replace(/\/+$/, '')) {
    bounce('invalid_target', `This server only issues tokens for ${expectedResource}`)
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    // Come back to this exact URL once signed in, so no OAuth parameters are lost.
    const self = new URL(`${mcpResourceUrl().replace(MCP_PATH, '')}/oauth/authorize`)
    for (const [key, value] of Object.entries(params)) {
      const single = one(value)
      if (single !== null) self.searchParams.set(key, single)
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(self.pathname + self.search)}`)
  }

  const userId = (session.user as { id?: string }).id
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, status: true } })
    : null

  if (!user || user.status !== 'active' || user.role !== 'admin') {
    return (
      <ErrorView
        title="Admin access required"
        detail="Only an active admin can connect an external assistant to Joyful CRM. You are signed in with an account that cannot grant this."
      />
    )
  }

  const grantedScope = normalizeScope(scope)
  const ticket = signConsentTicket({
    clientDbId: client.id,
    clientName: client.name,
    redirectUri,
    codeChallenge: codeChallenge!,
    scope: grantedScope,
    resource: resource ?? expectedResource,
    state,
  })

  return (
    <ConsentForm
      ticket={ticket}
      clientName={client.name}
      userName={user.name}
      userEmail={user.email}
      canWrite={grantedScope.split(' ').includes(SCOPE_WRITE)}
      readScope={SCOPE_READ}
      writeScope={SCOPE_WRITE}
    />
  )
}
