export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import {
  findClientByPhone, checkAvailability, listClientServices,
  createService, rescheduleOrCancelService, createSqftEstimate, scheduleEstimateVisit,
  getCurrentDate,
} from '@/lib/ai-handlers'

// Retell calls a custom function's `url` via POST with { name, call, args }
// and expects a 200 response whose body (string or JSON) is read back to the
// LLM. Unlike Vapi, it's one function call per request — no batching, no
// toolCallId to match up. Reuses the same handlers as the Vapi webhook.
const HANDLERS: Record<string, (args: any) => Promise<{ status: number; body: any }>> = {
  get_current_date: () => getCurrentDate(),
  find_client_by_phone: (args) => findClientByPhone(args.phone),
  check_availability: (args) => checkAvailability(args.date),
  schedule_service: (args) => createService(args),
  list_client_services: (args) => listClientServices(args.clientId, args.phone),
  reschedule_or_cancel_service: (args) => rescheduleOrCancelService(args.serviceId, args),
  create_sqft_estimate: (args) => createSqftEstimate(args),
  schedule_estimate_visit: (args) => scheduleEstimateVisit(args),
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
