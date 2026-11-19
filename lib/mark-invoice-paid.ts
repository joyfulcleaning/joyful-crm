import { prisma } from './prisma'
import { businessToday } from './business-date'
import { notifyEvent } from './notify-admin'
import { recalcInvoiceBalance } from './invoice-totals'
import { computeInvoiceAmounts } from './invoice-amounts'

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Records a payment coming from a payment-processor webhook (Stripe/Square)
 * and recomputes the invoice's paid/balance/status the same way the manual
 * "record payment" flow does. Idempotent per `reference` — a webhook that
 * fires twice for the same charge won't double-count it.
 *
 * `tip` is what the client added at the processor's checkout, on top of
 * `amount`. It is added to the invoice's own tip (so it shows on the invoice
 * and reaches payroll) and the payment row covers both.
 */
export async function recordAutomaticPayment(params: {
  invoiceId: string
  amount: number
  tip?: number
  platform: 'stripe' | 'square'
  reference: string
}) {
  const { invoiceId, platform, reference } = params
  const tip    = Math.max(0, params.tip ?? 0)
  const amount = Math.round((params.amount + tip) * 100) / 100

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { name: true } } },
  })
  if (!invoice) return

  const alreadyRecorded = await prisma.invoicePayment.findFirst({ where: { invoiceId, reference } })
  if (alreadyRecorded) return

  const paidAt = businessToday()

  // Tip and payment land together, so a retry either sees both or neither.
  await prisma.$transaction(async tx => {
    if (tip > 0) {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: computeInvoiceAmounts({
          subtotal:       invoice.subtotal,
          additionalFees: invoice.additionalFees,
          taxRate:        invoice.taxRate,
          cardFeeRate:    invoice.cardFeeRate,
          tipAmount:      Number(invoice.tipAmount) + tip,
        }),
      })
    }
    await tx.invoicePayment.create({
      data: {
        invoiceId,
        amount,
        method: 'card',
        platform,
        reference,
        notes: tip > 0
          ? `Auto-recorded from ${platform} webhook (includes ${fmtMoney(tip)} tip)`
          : `Auto-recorded from ${platform} webhook`,
        createdById: invoice.createdById,
        paidAt,
      },
    })
  })

  const balance = await recalcInvoiceBalance(invoiceId)

  if (balance?.justSettled) {
    const platformLabel = platform === 'stripe' ? 'Stripe' : 'Square'
    await notifyEvent('paid', {
      pushTitle: 'Payment received',
      pushBody:  `${fmtMoney(amount)} paid via ${platformLabel}${tip > 0 ? ` (incl. ${fmtMoney(tip)} tip)` : ''} — Invoice ${invoice.invoiceNumber} (${invoice.client?.name ?? 'client'})`,
      pushData:  { type: 'invoicePaid', invoiceId },
      emailSubject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      emailHtml: `
        <p>A payment was just approved and recorded automatically.</p>
        <ul>
          <li><strong>Invoice:</strong> ${invoice.invoiceNumber}</li>
          <li><strong>Client:</strong> ${invoice.client?.name ?? '—'}</li>
          <li><strong>Amount:</strong> ${fmtMoney(amount)}</li>
          ${tip > 0 ? `<li><strong>Tip:</strong> ${fmtMoney(tip)} (added by the client at checkout)</li>` : ''}
          <li><strong>Platform:</strong> ${platformLabel}</li>
        </ul>
        <p>The invoice is now fully paid.</p>
      `,
    })
  }
}
