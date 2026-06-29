import {
  requestService, requestRescheduleOrCancel, requestSqftEstimate, requestEstimateVisit, notifyFollowUpNeeded,
} from '@/lib/ai-requests'
import type { HandlerResult } from '@/lib/ai-handlers'

// Fed by the post-call analysis step on each platform (Vapi's analysisPlan /
// Retell's post_call_analysis_data) once a call has fully ended — not by a
// live tool call mid-conversation. One canonical field set regardless of
// platform; the canonical names below get mapped onto whatever each
// request*() in lib/ai-requests.ts actually expects.
export type ExtractedRequest = {
  requestType: 'schedule_service' | 'reschedule_or_cancel_service' | 'create_sqft_estimate' | 'schedule_estimate_visit' | 'none'
  clientId?: string
  callerName?: string
  callerPhone?: string
  callerEmail?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  unit?: string
  serviceType?: string  // cleaning type for schedule_service, or Rough/Final/Touch Up for create_sqft_estimate
  roomSize?: string
  frequency?: string
  serviceDate?: string
  serviceTime?: string
  serviceId?: string    // reschedule_or_cancel_service only
  cancel?: boolean      // reschedule_or_cancel_service only — true = cancel, false/absent = reschedule
  sqft?: number          // create_sqft_estimate only
  visitDate?: string    // schedule_estimate_visit only
  visitTime?: string
  notes?: string
}

type CallMeta = { callId?: string; transcript?: string; summary?: string }

// Invoked fire-and-forget from the end-of-call webhook routes — the caller
// has already hung up, there's no result to speak back. Reuses the exact
// same validation/approval-queue logic the live mid-call tools used to call
// directly: if a request*() call comes back >=400 (missing required field),
// that's treated as an incomplete extraction, not a hard error.
export async function submitExtractedRequest(
  data: ExtractedRequest,
  platform: 'vapi' | 'retell',
  meta: CallMeta
): Promise<void> {
  if (!data || data.requestType === 'none' || !data.requestType) return

  let result: HandlerResult

  switch (data.requestType) {
    case 'schedule_service':
      result = await requestService({
        clientId: data.clientId,
        clientName: data.callerName,
        clientPhone: data.callerPhone,
        clientEmail: data.callerEmail,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        unit: data.unit,
        type: data.serviceType,
        roomSize: data.roomSize,
        frequency: data.frequency,
        serviceDate: data.serviceDate,
        serviceTime: data.serviceTime,
        notes: data.notes,
      }, platform)
      break

    case 'reschedule_or_cancel_service':
      if (!data.serviceId) {
        await notifyFollowUpNeeded(platform, meta, data, 'Caller wanted to reschedule/cancel but the service could not be identified from the call.')
        return
      }
      result = await requestRescheduleOrCancel(data.serviceId, {
        callerPhone: data.callerPhone,
        serviceDate: data.serviceDate,
        serviceTime: data.serviceTime,
        status: data.cancel ? 'cancelled' : undefined,
      }, platform)
      break

    case 'create_sqft_estimate':
      result = await requestSqftEstimate({
        name: data.callerName,
        phone: data.callerPhone,
        email: data.callerEmail,
        address: data.address,
        sqft: data.sqft,
        type: data.serviceType,
        notes: data.notes,
        clientId: data.clientId,
      }, platform)
      break

    case 'schedule_estimate_visit':
      result = await requestEstimateVisit({
        clientId: data.clientId,
        name: data.callerName,
        phone: data.callerPhone,
        email: data.callerEmail,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        notes: data.notes,
      }, platform)
      break

    default:
      return
  }

  if (result.status >= 400) {
    await notifyFollowUpNeeded(platform, meta, data, result.body?.error || 'Extraction was incomplete.')
  }
}
