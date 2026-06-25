export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { findClientByPhone, checkAvailability, listClientServices } from '@/lib/ai-handlers'
import {
  requestService, requestRescheduleOrCancel, requestSqftEstimate, requestEstimateVisit,
} from '@/lib/ai-requests'

// Vapi calls every tool via POST to this single webhook, wrapping the call
// in `message.toolCallList` regardless of the tool's own semantics. This
// adapter unwraps that and calls the same handler functions the /api/ai/*
// REST routes use directly — no internal HTTP self-call, which added a slow
// extra network hop in a live voice call.
//
// The 4 write actions go through the approval queue (lib/ai-requests.ts)
// instead of executing immediately — they submit an AiRequest for staff
// review and only run for real once approved.
const HANDLERS: Record<string, (args: any) => Promise<{ status: number; body: any }>> = {
  find_client_by_phone: (args) => findClientByPhone(args.phone),
  check_availability: (args) => checkAvailability(args.date),
  schedule_service: (args) => requestService(args, 'vapi'),
  list_client_services: (args) => listClientServices(args.clientId, args.phone),
  reschedule_or_cancel_service: (args) => requestRescheduleOrCancel(args.serviceId, args, 'vapi'),
  create_sqft_estimate: (args) => requestSqftEstimate(args, 'vapi'),
  schedule_estimate_visit: (args) => requestEstimateVisit(args, 'vapi'),
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
        // Vapi's docs say `arguments` is a JSON-encoded string, but in
        // practice the live webhook sends it already parsed as an object —
        // handle both so a format change on either side doesn't break this.
        const raw = call.function?.arguments
        const args = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
        const handler = HANDLERS[name]
        if (!handler) return { name, toolCallId, error: `Unknown tool: ${name}` }

        const { status, body: result } = await handler(args)
        if (status >= 400) return { name, toolCallId, error: result.error || `Request failed (${status})` }
        return { name, toolCallId, result: JSON.stringify(result) }
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
