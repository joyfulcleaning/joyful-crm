import Stripe from 'stripe'
import { SquareClient, SquareEnvironment } from 'square'
import { getPaymentConfig } from './payment-config'

export async function isStripeConfigured() {
  const cfg = await getPaymentConfig()
  return !!cfg.stripeSecretKey
}

export async function isSquareConfigured() {
  const cfg = await getPaymentConfig()
  return !!(cfg.squareAccessToken && cfg.squareLocationId)
}

async function getStripe(): Promise<Stripe> {
  const cfg = await getPaymentConfig()
  if (!cfg.stripeSecretKey) throw new Error('Stripe is not configured')
  return new Stripe(cfg.stripeSecretKey)
}

async function getSquare(): Promise<{ client: SquareClient; locationId: string }> {
  const cfg = await getPaymentConfig()
  if (!cfg.squareAccessToken || !cfg.squareLocationId) throw new Error('Square is not configured')
  const client = new SquareClient({
    token: cfg.squareAccessToken,
    environment: cfg.squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  })
  return { client, locationId: cfg.squareLocationId }
}

type PayableInvoice = {
  id: string
  invoiceNumber: string
  balanceDue: number | string | { toString(): string }
  total: number | string | { toString(): string }
}

function amountDueCents(invoice: PayableInvoice): number {
  const amount = Number(invoice.balanceDue) || Number(invoice.total) || 0
  const cents = Math.round(amount * 100)
  if (cents <= 0) throw new Error('Invoice has no balance due')
  return cents
}

export type GeneratedLink = { url: string; id: string }

// Metadata on a Stripe Payment Link is copied onto every Checkout Session it
// generates, so the webhook can read invoiceId straight off the session —
// no separate lookup table needed.
export async function createStripePaymentLink(invoice: PayableInvoice): Promise<GeneratedLink> {
  const stripe = await getStripe()
  const cents = amountDueCents(invoice)
  const link = await stripe.paymentLinks.create({
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Invoice ${invoice.invoiceNumber}` },
        unit_amount: cents,
      },
      quantity: 1,
    }],
    metadata: { invoiceId: invoice.id },
    payment_intent_data: { metadata: { invoiceId: invoice.id } },
  })
  return { url: link.url, id: link.id }
}

// Square's Quick Pay links don't carry a reference back to our invoice, so we
// build the link from a minimal Order instead — Order.referenceId round-trips
// reliably and the webhook looks it up via orders.get(orderId).
export async function createSquarePaymentLink(invoice: PayableInvoice): Promise<GeneratedLink> {
  const { client: square, locationId } = await getSquare()
  const cents = amountDueCents(invoice)
  const response = await square.checkout.paymentLinks.create({
    idempotencyKey: `invoice-${invoice.id}-${Date.now()}`,
    order: {
      locationId,
      referenceId: invoice.id,
      lineItems: [{
        name: `Invoice ${invoice.invoiceNumber}`,
        quantity: '1',
        basePriceMoney: { amount: BigInt(cents), currency: 'USD' },
      }],
    },
  })
  const url = response.paymentLink?.url
  const id = response.paymentLink?.id
  if (!url || !id) throw new Error('Square did not return a payment link')
  return { url, id }
}

export async function getSquareOrderReferenceId(orderId: string): Promise<string | undefined> {
  const { client: square } = await getSquare()
  const { order } = await square.orders.get({ orderId })
  return order?.referenceId ?? undefined
}

// Stripe Payment Links can't be deleted, only deactivated — the URL then
// shows the buyer a "this link is no longer active" page. That's Stripe's
// intended lifecycle (links stay around for reporting), so this is the
// correct equivalent of "delete" for Stripe.
export async function deactivateStripePaymentLink(linkId: string): Promise<void> {
  const stripe = await getStripe()
  await stripe.paymentLinks.update(linkId, { active: false })
}

export async function deleteSquarePaymentLink(linkId: string): Promise<void> {
  const { client: square } = await getSquare()
  await square.checkout.paymentLinks.delete({ id: linkId })
}
