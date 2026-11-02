/**
 * Pure invoice arithmetic — no database, no imports, safe in the browser.
 *
 * Lives apart from `invoice-totals.ts` (which talks to Prisma) so the invoice
 * form can preview exactly the numbers the server will store, instead of
 * keeping a second copy of the formula that drifts.
 */

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface InvoiceAmountsInput {
  subtotal:        unknown
  additionalFees?: unknown
  taxRate?:        unknown
  cardFeeRate?:    unknown
  tipAmount?:      unknown
}

export interface InvoiceAmounts {
  subtotal:       number
  additionalFees: number
  taxRate:        number
  taxAmount:      number
  cardFeeRate:    number
  cardFeeAmount:  number
  tipAmount:      number
  total:          number
}

/**
 * Derives every money field on an invoice from the few inputs an admin
 * actually chooses. Never trust a client-supplied `total` — pass the inputs
 * and use what comes back.
 *
 * Order matters: the card fee is charged on the work plus tax, because that
 * is what the processor runs. The tip is excluded from the fee base — the
 * house does not take a cut of the crew's tip — but it does count toward
 * what the client owes.
 */
export function computeInvoiceAmounts(input: InvoiceAmountsInput): InvoiceAmounts {
  const subtotal       = money(num(input.subtotal))
  const additionalFees = money(num(input.additionalFees))
  const taxRate        = num(input.taxRate)
  const cardFeeRate    = num(input.cardFeeRate)
  const tipAmount      = money(num(input.tipAmount))

  const work          = money(subtotal + additionalFees)
  const taxAmount     = money(work * (taxRate / 100))
  const cardFeeAmount = money((work + taxAmount) * (cardFeeRate / 100))
  const total         = money(work + taxAmount + cardFeeAmount + tipAmount)

  return { subtotal, additionalFees, taxRate, taxAmount, cardFeeRate, cardFeeAmount, tipAmount, total }
}
