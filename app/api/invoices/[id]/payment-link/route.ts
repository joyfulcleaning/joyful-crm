export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import {
  createStripePaymentLink, createSquarePaymentLink, isStripeConfigured, isSquareConfigured,
  deactivateStripePaymentLink, deleteSquarePaymentLink,
} from '@/lib/payments'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const { provider } = await request.json()
    if (provider !== 'stripe' && provider !== 'square') {
      return NextResponse.json({ error: 'provider must be "stripe" or "square"' }, { status: 400 })
    }
    if (provider === 'stripe' && !(await isStripeConfigured())) {
      return NextResponse.json({ error: 'Stripe is not configured yet. Add the Stripe secret key in Settings → Integrations.' }, { status: 400 })
    }
    if (provider === 'square' && !(await isSquareConfigured())) {
      return NextResponse.json({ error: 'Square is not configured yet. Add the Square access token and location ID in Settings → Integrations.' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const payable = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      balanceDue: invoice.balanceDue,
      total: invoice.total,
    }

    const { url, id: linkId } = provider === 'stripe'
      ? await createStripePaymentLink(payable)
      : await createSquarePaymentLink(payable)

    const updated = await prisma.invoice.update({
      where: { id },
      data: provider === 'stripe'
        ? { paymentLinkStripe: url, paymentLinkStripeId: linkId }
        : { paymentLinkSquare: url, paymentLinkSquareId: linkId },
    })

    return NextResponse.json({ url, invoice: updated })
  } catch (error: any) {
    console.error('Error creating payment link:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create payment link' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const { provider } = await request.json()
    if (provider !== 'stripe' && provider !== 'square') {
      return NextResponse.json({ error: 'provider must be "stripe" or "square"' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const linkId = provider === 'stripe' ? invoice.paymentLinkStripeId : invoice.paymentLinkSquareId

    // Best-effort remote deactivation — links created before this field existed
    // won't have an ID on file, so we just clear our own record in that case.
    if (linkId) {
      try {
        if (provider === 'stripe') await deactivateStripePaymentLink(linkId)
        else await deleteSquarePaymentLink(linkId)
      } catch (err) {
        console.error(`Failed to ${provider === 'stripe' ? 'deactivate' : 'delete'} ${provider} payment link ${linkId}:`, err)
      }
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: provider === 'stripe'
        ? { paymentLinkStripe: null, paymentLinkStripeId: null }
        : { paymentLinkSquare: null, paymentLinkSquareId: null },
    })

    return NextResponse.json({ invoice: updated })
  } catch (error: any) {
    console.error('Error deleting payment link:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete payment link' }, { status: 500 })
  }
}
