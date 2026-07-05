export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { WebhooksHelper } from 'square'
import { getSquareOrderReferenceId } from '@/lib/payments'
import { recordAutomaticPayment } from '@/lib/mark-invoice-paid'
import { getPaymentConfig } from '@/lib/payment-config'

export async function POST(request: Request) {
  const config = await getPaymentConfig()
  const signatureKey = config.squareWebhookSignatureKey
  const signatureHeader = request.headers.get('x-square-hmacsha256-signature')
  if (!signatureKey || !signatureHeader) {
    return NextResponse.json({ error: 'Square webhook is not configured' }, { status: 400 })
  }

  const rawBody = await request.text()
  const notificationUrl = config.squareWebhookUrl || request.url

  const valid = await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey,
    notificationUrl,
  })
  if (!valid) {
    console.error('Square webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const body = JSON.parse(rawBody)

  if (body.type === 'payment.updated') {
    const payment = body.data?.object?.payment
    if (payment?.status === 'COMPLETED' && payment?.order_id) {
      try {
        const invoiceId = await getSquareOrderReferenceId(payment.order_id)
        const amount = Number(payment.amount_money?.amount ?? 0) / 100
        if (invoiceId && amount > 0) {
          await recordAutomaticPayment({
            invoiceId,
            amount,
            platform: 'square',
            reference: payment.id,
          })
        }
      } catch (err) {
        console.error('Failed to record Square payment:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
