import { prisma } from './prisma'
import { businessToday } from './business-date'

/**
 * Server-side invoice money: persists what `invoice-amounts.ts` computes.
 *
 * Before this existed, `total` was computed in the browser and trusted by the
 * create route, while `balanceDue` was recomputed by hand in four different
 * places that did not agree with each other — and never at all when an
 * invoice was first created, which is why every unpaid invoice in the database
 * reported a balance of zero. Every write that can move an invoice's money
 * now goes through here.
 *
 * The arithmetic itself lives in `invoice-amounts.ts`, which imports nothing,
 * so the invoice form can preview the same numbers without pulling Prisma
 * into the browser bundle.
 */

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface BalanceResult {
  amountPaid: number
  balanceDue: number
  /** True when this recalculation left the invoice fully paid. */
  settled:    boolean
  /** True when it became fully paid *now* — the trigger for "paid" notifications. */
  justSettled: boolean
  total:      number
}

/**
 * Recomputes `amountPaid` / `balanceDue` / `status` / `paidAt` and persists
 * them.
 *
 * `basis` decides where "how much was paid" comes from:
 *   - `payments` (default) — sum the payment rows. Use when a payment was
 *     added or removed.
 *   - `recorded` — keep the stored `amountPaid`. Use when the *total* moved
 *     (a tip was added, the card fee was toggled, the tax rate changed).
 *     This matters because "Mark as paid" settles an invoice without writing
 *     a payment row, so re-deriving from payments would quietly un-pay it.
 *
 * Status rules, unified from the three variants that used to disagree:
 *   - fully paid            -> `paid`, stamped with the existing paidAt or today
 *   - still owing something -> only a `paid` invoice is demoted (to `sent`);
 *     `draft` / `sent` / `overdue` keep their own status, and paidAt is cleared
 *
 * Callers own their notifications — `justSettled` tells them when to fire.
 */
export async function recalcInvoiceBalance(
  invoiceId: string,
  opts: { basis?: 'payments' | 'recorded' } = {}
): Promise<BalanceResult | null> {
  const invoice = await prisma.invoice.findUnique({
    where:  { id: invoiceId },
    select: { total: true, status: true, paidAt: true, amountPaid: true },
  })
  if (!invoice) return null

  const total = money(num(invoice.total))

  let amountPaid: number
  if (opts.basis === 'recorded') {
    amountPaid = money(num(invoice.amountPaid))
  } else {
    const payments = await prisma.invoicePayment.findMany({
      where:  { invoiceId },
      select: { amount: true },
    })
    amountPaid = money(payments.reduce((sum, p) => sum + num(p.amount), 0))
  }

  const balanceDue = money(Math.max(0, total - amountPaid))

  // An invoice with nothing on it is not "paid" just because zero is owed.
  const settled     = balanceDue === 0 && total > 0
  const justSettled = settled && invoice.status !== 'paid'

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid,
      balanceDue,
      status: settled ? 'paid' : invoice.status === 'paid' ? 'sent' : invoice.status,
      paidAt: settled ? (invoice.paidAt ?? businessToday()) : null,
    },
  })

  return { amountPaid, balanceDue, settled, justSettled, total }
}
