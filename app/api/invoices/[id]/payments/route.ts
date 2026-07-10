export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { businessToday } from '@/lib/business-date'
import { logAudit } from '@/lib/audit'

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

    // Recalcula amountPaid y balanceDue
    const allPayments = await prisma.invoicePayment.findMany({ where: { invoiceId: id } })
    const amountPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balanceDue = Math.max(0, Number(invoice.total) - amountPaid)

    // Actualiza el invoice — si balance = 0 → status paid
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid,
        balanceDue,
        status:  balanceDue === 0 ? 'paid' : invoice.status === 'paid' ? 'sent' : invoice.status,
        paidAt:  balanceDue === 0 ? businessToday() : null,
      },
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
    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const allPayments = await prisma.invoicePayment.findMany({ where: { invoiceId: id } })
    const amountPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balanceDue = Math.max(0, Number(invoice.total) - amountPaid)

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid,
        balanceDue,
        status: balanceDue === 0 ? 'paid' : 'sent',
        paidAt: balanceDue === 0 ? businessToday() : null,
      }
    })

    return NextResponse.json({ invoice: updatedInvoice })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}