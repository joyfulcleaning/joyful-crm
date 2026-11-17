import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { asLang, isExpired, offeredDays, ymd, FlowEvent, DayWindow } from '@/lib/estimate-flow'
import EstimatePortal, { PortalData } from './EstimatePortal'

export const dynamic = 'force-dynamic'

// The page a client opens from the estimate email or text. No login: the
// token in the URL is the credential (see app/api/public/estimates/[token]).
// Only what the client already received is shown — never internal notes.

export const metadata: Metadata = {
  title: 'Your estimate · Joyful Cleaning Services',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ token: string }> }

export default async function EstimatePage({ params }: Props) {
  const { token } = await params
  const est = token && token.length >= 16
    ? await prisma.estimate.findUnique({
        where: { publicToken: token },
        include: { service: { select: { serviceDate: true, serviceTime: true, status: true } } },
      })
    : null

  if (!est || est.status === 'cancelled') return <EstimatePortal data={null} token={token} />

  const events = (Array.isArray(est.events) ? est.events : []) as FlowEvent[]
  const lastOf = (...types: FlowEvent['type'][]) => [...events].reverse().find(e => types.includes(e.type))
  const proposal = lastOf('proposed')
  const pick = lastOf('accepted', 'suggested')
  const items = (Array.isArray(est.items) ? est.items : []) as Array<Record<string, unknown>>
  const closed = est.status === 'service_created' || !!est.serviceId
  const needsDays = !closed && (est.response === null || est.response === 'accepted')

  const data: PortalData = {
    lang: asLang(est.lang),
    number: est.estimateNumber,
    clientName: est.clientName,
    address: est.clientAddress,
    items: items.map(it => {
      const qty = Number(it.qty ?? 1)
      const unitPrice = Number(it.unitPrice ?? it.unit_price ?? 0)
      return { description: String(it.description ?? ''), qty, total: Number(it.total ?? qty * unitPrice) }
    }),
    subtotal: Number(est.subtotal),
    tax: Number(est.tax),
    taxRate: Number(est.taxRate),
    total: Number(est.total),
    validUntil: ymd(est.validUntil),
    notes: est.notes,
    response: (est.response as PortalData['response']) ?? null,
    respondedAt: est.respondedAt?.toISOString() ?? null,
    expired: isExpired(est.validUntil),
    booked: est.service && est.service.status !== 'cancelled' ? { date: ymd(est.service.serviceDate), time: est.service.serviceTime } : null,
    closed,
    pending: (est.schedulingPending as 'team' | 'client' | null) ?? null,
    agreed: est.agreedDate && est.agreedTime ? { date: ymd(est.agreedDate), time: est.agreedTime } : null,
    proposal: proposal?.date && proposal.time ? { date: proposal.date, time: proposal.time, note: proposal.note ?? null } : null,
    pick: pick?.date && pick.window ? { date: pick.date, window: pick.window as DayWindow } : null,
    offered: needsDays ? await offeredDays(5) : [],
  }

  return <EstimatePortal data={data} token={token} />
}
