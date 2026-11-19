// Where an estimate visit stands, from the visit and the estimate linked to
// it (GET /api/estimate-visits includes a summary of it). Same rules as the
// app's lib/estimate-stage.ts, so the web and the phone always agree.
// Client-safe: lib/estimate-flow.ts pulls in Prisma.

export type VisitStage =
  | 'scheduled' | 'quoted' | 'sent' | 'viewed' | 'changes' | 'declined'
  | 'accepted' | 'proposed' | 'agreed' | 'service' | 'cancelled'

export function visitStage(v: any): VisitStage {
  if (v?.status === 'cancelled') return 'cancelled'
  const e = v?.estimate
  if (!e) return 'scheduled'
  if (e.serviceId || e.status === 'service_created') return 'service'
  if (e.response === 'accepted') return e.agreedDate ? 'agreed' : e.schedulingPending === 'client' ? 'proposed' : 'accepted'
  if (e.response === 'changes') return 'changes'
  if (e.response === 'declined') return 'declined'
  if (e.sentAt || e.emailSentAt) return e.viewedAt ? 'viewed' : 'sent'
  return 'quoted'
}

// Index in the visit's step bar: Visit · Estimate · Sent · Accepted · Service.
export const STAGE_STEP: Record<VisitStage, number> = {
  scheduled: 0, quoted: 1, sent: 2, viewed: 2, changes: 2,
  declined: 3, accepted: 3, proposed: 3, agreed: 3, service: 4, cancelled: -1,
}

export const ESTIMATE_VISIT_COLOR = '#ec4899'

export function stageColor(stage: VisitStage): string {
  switch (stage) {
    case 'scheduled': return ESTIMATE_VISIT_COLOR
    case 'quoted':
    case 'changes':   return '#f59e0b'
    case 'sent':
    case 'viewed':
    case 'proposed':  return '#4f8ef7'
    case 'accepted':
    case 'agreed':    return '#26BD97'
    case 'service':   return '#a78bfa'
    case 'declined':
    case 'cancelled': return '#f87171'
  }
}
