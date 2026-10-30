export const dynamic = 'force-dynamic'
import { authenticateAssistant, wwwAuthenticateHeader } from '@/lib/oauth'
import { callTool, listTools } from '@/lib/assistant-tools'

/**
 * MCP endpoint — Streamable HTTP transport, stateless.
 *
 * Stateless by design: this runs on Vercel's serverless runtime where no
 * in-memory session survives between invocations, so no Mcp-Session-Id is
 * issued and every POST stands alone. The spec permits that (session IDs are
 * MAY), and nothing here needs server-initiated messages.
 *
 * The response is framed as SSE or plain JSON depending on what the client
 * accepts — the spec allows either for a request, and ChatGPT has shipped
 * clients that insist on each.
 */

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const LATEST_PROTOCOL_VERSION = '2025-06-18'

const SERVER_INFO = { name: 'joyful-crm', title: 'Joyful CRM', version: '1.0.0' }

const INSTRUCTIONS = `Joyful CRM — the cleaning business's own system of record.

Use these tools whenever the user asks about their business: the schedule, clients, invoices, payments, expenses, staff or stock. Everything returned is live data from their database, not an estimate.

Working rules:
- Call get_today before reasoning about any relative date. Never assume today's date.
- Turn names into ids with search_clients / list_staff / list_inventory before calling a tool that takes an id. If the search returns more than one plausible match, ask which one.
- The crew works Monday to Friday, one job per hour from 08:00 to 17:00. The work week for reporting runs Saturday to Friday.
- Money: "completed service value" and "cash collected" are different figures. Say which one you are quoting.
- Some tools answer with confirmationRequired: true and a preview instead of acting. That is not an error — read the preview back to the user, get a yes, then call the same tool again with confirm: true.
- The user is often driving. Lead with the answer, keep it short, and don't read out ids or raw JSON.`

type JsonRpcId = string | number | null

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result }
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data === undefined ? {} : { data }) } }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
}

/**
 * Chooses the response framing. The spec lets the server answer a request with
 * either `application/json` or `text/event-stream`, and requires clients to
 * handle both — and it also requires clients to advertise both in Accept, so
 * "client mentioned SSE" says nothing about what it prefers.
 *
 * Plain JSON is therefore the default: every response here is a single
 * immediate JSON-RPC result with nothing to stream, and JSON avoids the
 * buffering and idle-timeout behaviour that event streams hit behind
 * serverless proxies. SSE is used only for a client that accepts nothing else.
 */
function respond(payload: unknown, accept: string, status = 200) {
  const acceptsJson = accept === '' || accept.includes('application/json') || accept.includes('*/*')
  if (accept.includes('text/event-stream') && !acceptsJson) {
    const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`
    return new Response(body, {
      status,
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * DNS rebinding protection (required by the transport spec). ChatGPT calls
 * server-to-server and sends no Origin, which is allowed; a browser-originated
 * request must come from this deployment itself.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const allowed = [process.env.NEXTAUTH_URL, ...(process.env.MCP_ALLOWED_ORIGINS?.split(',') ?? [])]
    .filter(Boolean)
    .map(o => o!.trim().replace(/\/+$/, ''))
  return allowed.includes(origin.replace(/\/+$/, ''))
}

export async function POST(request: Request) {
  const accept = request.headers.get('accept') || ''

  if (!originAllowed(request)) {
    return respond(rpcError(null, -32600, 'Origin not allowed'), accept, 403)
  }

  const protocolHeader = request.headers.get('mcp-protocol-version')
  if (protocolHeader && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolHeader)) {
    return respond(
      rpcError(null, -32600, `Unsupported MCP-Protocol-Version: ${protocolHeader}`),
      accept,
      400
    )
  }

  // Auth before parsing: an unauthenticated caller must get the 401 with
  // WWW-Authenticate that kicks off OAuth discovery, whatever the body says.
  const auth = await authenticateAssistant(request)
  if ('error' in auth) {
    const isMissing = auth.error === 'missing'
    return new Response(
      JSON.stringify(
        rpcError(null, -32001, isMissing ? 'Authorization required' : (auth.description ?? 'Invalid access token'))
      ),
      {
        status: 401,
        headers: {
          ...CORS,
          'Content-Type': 'application/json',
          'WWW-Authenticate': wwwAuthenticateHeader(
            request,
            isMissing ? undefined : 'invalid_token',
            isMissing ? undefined : auth.description
          ),
        },
      }
    )
  }

  const { principal } = auth

  let message: { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
  try {
    message = await request.json()
  } catch {
    return respond(rpcError(null, -32700, 'Parse error: body is not valid JSON'), accept, 400)
  }

  if (Array.isArray(message)) {
    return respond(rpcError(null, -32600, 'Batched requests are not supported'), accept, 400)
  }

  const id = message.id ?? null
  const method = message.method
  const params = message.params ?? {}

  // Notifications and responses carry no id and expect 202 with no body.
  const isNotification = message.id === undefined || message.id === null
  if (isNotification && typeof method === 'string' && method.startsWith('notifications/')) {
    return new Response(null, { status: 202, headers: CORS })
  }

  if (!method) {
    return respond(rpcError(id, -32600, 'Invalid request: method is required'), accept, 400)
  }

  try {
    switch (method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : null
        const protocolVersion =
          requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION
        return respond(
          rpcResult(id, {
            protocolVersion,
            capabilities: {
              // listChanged is false: the catalog is static per token scope, so
              // there is nothing to notify about (and no stream to notify on).
              tools: { listChanged: false },
            },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          }),
          accept
        )
      }

      case 'ping':
        return respond(rpcResult(id, {}), accept)

      case 'tools/list':
        return respond(rpcResult(id, { tools: listTools(principal.scope) }), accept)

      case 'tools/call': {
        const name = typeof params.name === 'string' ? params.name : null
        if (!name) return respond(rpcError(id, -32602, 'Invalid params: name is required'), accept)

        const args =
          params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
            ? (params.arguments as Record<string, unknown>)
            : {}

        const result = await callTool({
          name,
          args,
          actor: principal.user,
          scope: principal.scope,
          clientName: principal.clientName,
        })

        // A tool that rejects its input reports isError on the result rather
        // than failing the JSON-RPC call, so the model can read the message and
        // retry instead of seeing an opaque protocol error.
        const payload = result.ok ? result.data : { error: result.error }
        return respond(
          rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            structuredContent: result.ok ? (payload as Record<string, unknown>) : undefined,
            isError: !result.ok,
          }),
          accept
        )
      }

      // Declared empty rather than left unimplemented: clients probe these on
      // connect, and a -32601 shows up as a connection error in some UIs.
      case 'resources/list':
        return respond(rpcResult(id, { resources: [] }), accept)
      case 'resources/templates/list':
        return respond(rpcResult(id, { resourceTemplates: [] }), accept)
      case 'prompts/list':
        return respond(rpcResult(id, { prompts: [] }), accept)

      default:
        return respond(rpcError(id, -32601, `Method not found: ${method}`), accept)
    }
  } catch (error) {
    console.error(`[assistant/mcp] ${method} failed:`, error)
    return respond(rpcError(id, -32603, 'Internal error'), accept, 500)
  }
}

/**
 * The spec lets a server decline the server-to-client SSE stream with 405, and
 * a stateless server has nothing to push.
 */
export async function GET() {
  return new Response('This MCP endpoint does not offer a server-initiated SSE stream.', {
    status: 405,
    headers: { ...CORS, Allow: 'POST, OPTIONS' },
  })
}

/** No sessions to terminate, so explicit session deletion is declined. */
export async function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
