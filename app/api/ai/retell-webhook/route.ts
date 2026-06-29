export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized, isRetellSignatureValid } from '@/lib/ai-auth'
import { findClientByPhone, checkAvailability, listClientServices, getCurrentDate } from '@/lib/ai-handlers'
import { checkRequestStatus, notifyFollowUpNeeded } from '@/lib/ai-requests'
import { submitExtractedRequest, type ExtractedRequest } from '@/lib/ai-post-call'

// Retell calls a custom function's `url` via POST with { name, call, args }
// and expects a 200 response whose body (string or JSON) is read back to the
// LLM. Unlike Vapi, it's one function call per request — no batching, no
// toolCallId to match up. Reuses the same handlers as the Vapi webhook.
//
// The 4 write actions (schedule/reschedule/cancel/estimate) are no longer
// live tools at all — the agent only gathers and confirms the info out
// loud. The actual AiRequest only gets created after the call ends, from
// the call_analyzed branch below, so a mid-call change of mind never leaves
// a stale request behind.
const HANDLERS: Record<string, (args: any) => Promise<{ status: number; body: any }>> = {
  get_current_date: () => getCurrentDate(),
  find_client_by_phone: (args) => findClientByPhone(args.phone),
  check_availability: (args) => checkAvailability(args.date),
  list_client_services: (args) => listClientServices(args.clientId, args.phone),
  check_request_status: (args) => checkRequestStatus(args.phone),
}

export async function POST(request: Request) {
  // Read the raw body once — needed verbatim (not re-stringified) for the
  // call_analyzed signature check below, so this can't be request.json().
  const rawBody = await request.text()
  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // call_analyzed (and the other call lifecycle events) arrive at the
  // Agent-level `webhook_url`, a separate config surface from the per-Tool
  // `general_tools` URL used below — signed by Retell itself rather than
  // carrying our own Authorization header, so it's checked differently.
  if (body.event) {
    if (body.event !== 'call_analyzed') return NextResponse.json({})

    if (!isRetellSignatureValid(rawBody, request.headers.get('x-retell-signature'))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    try {
      const callId: string | undefined = body.call?.call_id
      const transcript: string | undefined = body.call?.transcript
      const summary: string | undefined = body.call?.call_analysis?.call_summary
      const customData = body.call?.call_analysis?.custom_analysis_data as ExtractedRequest | undefined

      if (customData) {
        await submitExtractedRequest(customData, 'retell', { callId, transcript, summary })
      } else {
        await notifyFollowUpNeeded('retell', { callId, transcript, summary }, {}, 'Retell call_analyzed event did not return custom_analysis_data.')
      }
    } catch (err) {
      console.error('Error processing Retell call_analyzed event:', err)
    }
    return NextResponse.json({})
  }

  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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
