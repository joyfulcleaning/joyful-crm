export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { isAiAuthorized } from '@/lib/ai-auth'
import { findClientByPhone, checkAvailability, listClientServices } from '@/lib/ai-handlers'
import { checkRequestStatus, notifyFollowUpNeeded } from '@/lib/ai-requests'
import { submitExtractedRequest, type ExtractedRequest } from '@/lib/ai-post-call'

// Vapi calls every tool via POST to this single webhook, wrapping the call
// in `message.toolCallList` regardless of the tool's own semantics. This
// adapter unwraps that and calls the same handler functions the /api/ai/*
// REST routes use directly — no internal HTTP self-call, which added a slow
// extra network hop in a live voice call.
//
// The 4 write actions (schedule/reschedule/cancel/estimate) are no longer
// live tools at all — the agent only gathers and confirms the info out
// loud. The actual AiRequest only gets created after the call ends, from
// the end-of-call-report branch below, so a mid-call change of mind never
// leaves a stale request behind.
const HANDLERS: Record<string, (args: any) => Promise<{ status: number; body: any }>> = {
  find_client_by_phone: (args) => findClientByPhone(args.phone),
  check_availability: (args) => checkAvailability(args.date),
  list_client_services: (args) => listClientServices(args.clientId, args.phone),
  check_request_status: (args) => checkRequestStatus(args.phone),
}

export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // End-of-call analysis (Assistant `analysisPlan`) — fires once, after
    // the call has fully ended, to the same server URL as tool calls. No
    // result is read back into a conversation (there isn't one anymore), so
    // this always resolves with a plain 200 regardless of outcome.
    if (body?.message?.type === 'end-of-call-report') {
      const callId: string | undefined = body.message.call?.id
      const transcript: string | undefined = body.message.transcript || body.message.artifact?.transcript
      const summary: string | undefined = body.message.summary || body.message.analysis?.summary
      const structuredData: ExtractedRequest | undefined = body.message.analysis?.structuredData

      try {
        if (structuredData) {
          await submitExtractedRequest(structuredData, 'vapi', { callId, transcript, summary })
        } else {
          await notifyFollowUpNeeded('vapi', { callId, transcript, summary }, {}, 'Vapi end-of-call analysis did not return structured data.')
        }
      } catch (err) {
        console.error('Error processing Vapi end-of-call-report:', err)
      }
      return NextResponse.json({})
    }

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
