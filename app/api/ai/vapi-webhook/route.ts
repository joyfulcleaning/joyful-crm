export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'

// Vapi calls every tool via POST to this single webhook, wrapping the call
// in `message.toolCallList` regardless of the tool's own HTTP semantics.
// This adapter unwraps that, forwards to the matching existing /api/ai/*
// endpoint (already built, tested and authenticated independently), and
// wraps the response back into Vapi's expected `results` shape.
const BASE_URL = 'https://joyful-crm.vercel.app'

function authHeaders() {
  return { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' }
}

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  return sp.toString()
}

const HANDLERS: Record<string, (args: any) => Promise<Response>> = {
  find_client_by_phone: (args) =>
    fetch(`${BASE_URL}/api/ai/clients?${qs({ phone: args.phone })}`, { headers: authHeaders() }),

  check_availability: (args) =>
    fetch(`${BASE_URL}/api/ai/availability?${qs({ date: args.date })}`, { headers: authHeaders() }),

  schedule_service: (args) =>
    fetch(`${BASE_URL}/api/ai/services`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(args) }),

  list_client_services: (args) =>
    fetch(`${BASE_URL}/api/ai/services?${qs({ clientId: args.clientId, phone: args.phone })}`, { headers: authHeaders() }),

  reschedule_or_cancel_service: (args) =>
    fetch(`${BASE_URL}/api/ai/services/${args.serviceId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        callerPhone: args.callerPhone,
        serviceDate: args.serviceDate,
        serviceTime: args.serviceTime,
        status: args.status,
      }),
    }),

  create_sqft_estimate: (args) =>
    fetch(`${BASE_URL}/api/ai/estimates`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(args) }),

  schedule_estimate_visit: (args) =>
    fetch(`${BASE_URL}/api/ai/estimate-visits`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(args) }),
}

export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const toolCallList = body?.message?.toolCallList ?? []

    const results = await Promise.all(toolCallList.map(async (call: any) => {
      const name = call.function?.name
      const toolCallId = call.id
      try {
        const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}
        const handler = HANDLERS[name]
        if (!handler) {
          return { name, toolCallId, error: `Unknown tool: ${name}` }
        }
        const res = await handler(args)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          return { name, toolCallId, error: data.error || `Request failed (${res.status})` }
        }
        return { name, toolCallId, result: JSON.stringify(data) }
      } catch (err: any) {
        return { name, toolCallId, error: err?.message || 'Tool execution failed' }
      }
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error in POST /api/ai/vapi-webhook:', error)
    return NextResponse.json({ error: 'Failed to process tool calls' }, { status: 500 })
  }
}
