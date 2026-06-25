export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { findClientByPhone, checkAvailability, listClientServices, getCurrentDate } from '@/lib/ai-handlers'
import {
  requestService, requestRescheduleOrCancel, requestSqftEstimate, requestEstimateVisit,
} from '@/lib/ai-requests'

// Retell calls a custom function's `url` via POST with { name, call, args }
// and expects a 200 response whose body (string or JSON) is read back to the
// LLM. Unlike Vapi, it's one function call per request — no batching, no
// toolCallId to match up. Reuses the same handlers as the Vapi webhook.
//
// The 4 write actions go through the approval queue (lib/ai-requests.ts)
// instead of executing immediately — they submit an AiRequest for staff
// review and only run for real once approved.
const HANDLERS: Record<string, (args: any) => Promise<{ status: number; body: any }>> = {
  get_current_date: () => getCurrentDate(),
  find_client_by_phone: (args) => findClientByPhone(args.phone),
  check_availability: (args) => checkAvailability(args.date),
  schedule_service: (args) => requestService(args, 'retell'),
  list_client_services: (args) => listClientServices(args.clientId, args.phone),
  reschedule_or_cancel_service: (args) => requestRescheduleOrCancel(args.serviceId, args, 'retell'),
  create_sqft_estimate: (args) => requestSqftEstimate(args, 'retell'),
  schedule_estimate_visit: (args) => requestEstimateVisit(args, 'retell'),
}

export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, args } = body

    const handler = HANDLERS[name]
    if (!handler) {
      // 200 on purpose — a non-2xx here makes Retell retry the same call twice.
      return NextResponse.json({ error: `Unknown tool: ${name}` })
    }

    const { status, body: result } = await handler(args || {})
    if (status >= 400) {
      return NextResponse.json({ error: result.error || `Request failed (${status})` })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/ai/retell-webhook:', error)
    return NextResponse.json({ error: 'Tool execution failed' })
  }
}
