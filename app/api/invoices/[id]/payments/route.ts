export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { businessToday } from '@/lib/business-date'
import { logAudit } from '@/lib/audit'
import { notifyEvent } from '@/lib/notify-admin'
import { recalcInvoiceBalance } from '@/lib/invoice-totals'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const payments = await prisma.invoicePayment.findMany({
      where: { invoiceId: id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { paidAt: 'desc' }
    })
    return NextResponse.json(payments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    // Obtiene el invoice actual
    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const paymentAmount = parseFloat(body.amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Crea el pago
    const payment = await prisma.invoicePayment.create({
      data: {
        invoiceId:   id,
        amount:      paymentAmount,
        method:      body.method,
        platform:    body.platform || 'other',
        reference:   body.reference || null,
        notes:       body.notes || null,
        createdById: user.id,
        paidAt:      body.paidAt ? new Date(body.paidAt) : businessToday(),
      }
    })

    // Recalcula amountPaid / balanceDue / status / paidAt en un solo lugar
    const balance = await recalcInvoiceBalance(id)

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: {
        client: { select: { name: true } },
        payments: {
          include: { createdBy: { select: { name: true } } },
          orderBy: { paidAt: 'desc' }
        },
        items: {
          include: {
            service: {
              select: {
                serviceNumber: true,
                serviceDate:   true,
                type:          true,
                unit:          true,
                roomSize:      true,
                additionalFee: true,
              }
            }
          }
        },
      }
    })

    logAudit(user, 'create', 'payment', payment.id, {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      amount: payment.amount,
      method: payment.method,
    })

    // Notify admins when this payment settles the invoice in full. The
    // webhook flow (recordAutomaticPayment) already does this for Stripe/
    // Square; this covers manually recorded payments (cash, Zelle, etc.).
    if (balance?.justSettled) {
      const money = paymentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      const clientName = updatedInvoice.client?.name ?? 'client'
      notifyEvent('paid', {
        pushTitle: 'Invoice paid',
        pushBody:  `${money} (${body.method}) — Invoice ${invoice.invoiceNumber} (${clientName}), recorded by ${user.name}`,
        pushData:  { type: 'invoicePaid', invoiceId: id },
        emailSubject: `Invoice paid — ${invoice.invoiceNumber}`,
        emailHtml: `
          <p>An invoice was just paid in full.</p>
          <ul>
            <li><strong>Invoice:</strong> ${invoice.invoiceNumber}</li>
            <li><strong>Client:</strong> ${clientName}</li>
            <li><strong>Payment:</strong> ${money} (${body.method})</li>
            <li><strong>Recorded by:</strong> ${user.name}</li>
          </ul>
        `,
      }).catch(err => console.error('Error notifying invoice paid:', err))
    }

    return NextResponse.json({ payment, invoice: updatedInvoice })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
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
    const { paymentId } = await request.json()

    const deletedPayment = await prisma.invoicePayment.delete({ where: { id: paymentId } })

    logAudit(authUser, 'delete', 'payment', paymentId, {
      invoiceId: id,
      amount: deletedPayment.amount,
      method: deletedPayment.method,
    })

    // Recalcula después de borrar
    const balance = await recalcInvoiceBalance(id)
    if (!balance) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id } })

    return NextResponse.json({ invoice: updatedInvoice })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}