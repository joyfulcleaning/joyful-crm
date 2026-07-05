import { prisma } from './prisma'
import { businessToday } from './business-date'
import { notifyEvent } from './notify-admin'

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Records a payment coming from a payment-processor webhook (Stripe/Square)
 * and recomputes the invoice's paid/balance/status the same way the manual
 * "record payment" flow does. Idempotent per `reference` — a webhook that
 * fires twice for the same charge won't double-count it.
 */
export async function recordAutomaticPayment(params: {
  invoiceId: string
  amount: number
  platform: 'stripe' | 'square'
  reference: string
}) {
  const { invoiceId, amount, platform, reference } = params

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { name: true } } },
  })
  if (!invoice) return

  const alreadyRecorded = await prisma.invoicePayment.findFirst({ where: { invoiceId, reference } })
  if (alreadyRecorded) return

  const paidAt = businessToday()

  await prisma.invoicePayment.create({
    data: {
      invoiceId,
      amount,
      method: 'card',
      platform,
      reference,
      notes: `Auto-recorded from ${platform} webhook`,
      createdById: invoice.createdById,
      paidAt,
    },
  })

  const allPayments = await prisma.invoicePayment.findMany({ where: { invoiceId } })
  const amountPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balanceDue = Math.max(0, Number(invoice.total) - amountPaid)

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid,
      balanceDue,
      status: balanceDue === 0 ? 'paid' : invoice.status,
      paidAt: balanceDue === 0 ? paidAt : invoice.paidAt,
    },
  })

  if (balanceDue === 0) {
    const platformLabel = platform === 'stripe' ? 'Stripe' : 'Square'
    await notifyEvent('paid', {
      pushTitle: 'Payment received',
      pushBody:  `${fmtMoney(amount)} paid via ${platformLabel} — Invoice ${invoice.invoiceNumber} (${invoice.client?.name ?? 'client'})`,
      pushData:  { type: 'invoicePaid', invoiceId },
      emailSubject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      emailHtml: `
        <p>A payment was just approved and recorded automatically.</p>
        <ul>
          <li><strong>Invoice:</strong> ${invoice.invoiceNumber}</li>
          <li><strong>Client:</strong> ${invoice.client?.name ?? '—'}</li>
          <li><strong>Amount:</strong> ${fmtMoney(amount)}</li>
          <li><strong>Platform:</strong> ${platformLabel}</li>
        </ul>
        <p>The invoice is now fully paid.</p>
      `,
    })
  }
}
