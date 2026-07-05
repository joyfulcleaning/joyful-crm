import { prisma } from './prisma'

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

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  const alreadyRecorded = await prisma.invoicePayment.findFirst({ where: { invoiceId, reference } })
  if (alreadyRecorded) return

  await prisma.invoicePayment.create({
    data: {
      invoiceId,
      amount,
      method: 'card',
      platform,
      reference,
      notes: `Auto-recorded from ${platform} webhook`,
      createdById: invoice.createdById,
      paidAt: new Date(),
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
      paidAt: balanceDue === 0 ? new Date() : invoice.paidAt,
    },
  })
}
