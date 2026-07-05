export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { recordAutomaticPayment } from '@/lib/mark-invoice-paid'
import { getPaymentConfig } from '@/lib/payment-config'

export async function POST(request: Request) {
  const config = await getPaymentConfig()
  const secret = config.stripeWebhookSecret
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = new Stripe(config.stripeSecretKey || '')

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoiceId
    const amount = (session.amount_total ?? 0) / 100
    if (invoiceId && amount > 0) {
      try {
        await recordAutomaticPayment({
          invoiceId,
          amount,
          platform: 'stripe',
          reference: session.payment_intent as string ?? session.id,
        })
      } catch (err) {
        console.error('Failed to record Stripe payment for invoice', invoiceId, err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
