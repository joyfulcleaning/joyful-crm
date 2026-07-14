export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { notifyEvent } from '@/lib/notify-admin'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, propertyCode: true } },
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
        payments: {
          include: { createdBy: { select: { name: true } } },
          orderBy: { paidAt: 'desc' }
        },
      }
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(invoice)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    const updateData: any = {
      ...(body.status             !== undefined && { status:             body.status }),
      ...(body.paymentMethod      !== undefined && { paymentMethod:      body.paymentMethod }),
      ...(body.dueDate            !== undefined && { dueDate:            body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.notes              !== undefined && { notes:              body.notes }),
      ...(body.additionalFees     !== undefined && { additionalFees:     parseFloat(body.additionalFees) }),
      ...(body.taxRate            !== undefined && { taxRate:            parseFloat(body.taxRate) }),
      ...(body.paymentLinkStripe  !== undefined && { paymentLinkStripe:  body.paymentLinkStripe }),
      ...(body.paymentLinkSquare  !== undefined && { paymentLinkSquare:  body.paymentLinkSquare }),
      ...(body.paymentLinkVisible !== undefined && { paymentLinkVisible: !!body.paymentLinkVisible }),
      ...(body.emailSentAt        !== undefined && { emailSentAt:        body.emailSentAt ? new Date(body.emailSentAt) : null }),
      ...(body.issuedAt           !== undefined && { issuedAt:           body.issuedAt ? new Date(body.issuedAt + 'T12:00:00.000Z') : new Date() }),
    }

    // When marking as sent: auto-set dueDate 30 days from issuedAt if not already set
    if (body.status === 'sent') {
      const current = await prisma.invoice.findUnique({ where: { id }, select: { dueDate: true, issuedAt: true } })
      if (!current?.dueDate && !body.dueDate) {
        const base = current?.issuedAt ?? new Date()
        const due  = new Date(base)
        due.setDate(due.getDate() + 30)
        updateData.dueDate = due
      }
    }

    // When marking as paid: stamp paidAt (use provided date or keep existing or now)
    let wasAlreadyPaid = false
    if (body.status === 'paid') {
      const current = await prisma.invoice.findUnique({
        where: { id },
        select: { total: true, paidAt: true, status: true, invoiceNumber: true, client: { select: { name: true } } },
      })
      wasAlreadyPaid = current?.status === 'paid'
      updateData.paidAt      = body.paidAt
        ? new Date(body.paidAt + 'T12:00:00')
        : (current?.paidAt ?? new Date())
      updateData.amountPaid  = current?.total
      updateData.balanceDue  = 0
    }
    // When moving away from paid: clear the stamp
    if (body.status !== undefined && body.status !== 'paid') {
      updateData.paidAt = null
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { client: { select: { name: true } } },
    })

    logAudit(authUser, 'update', 'invoice', invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      changes: updateData,
    })

    // Notify admins when a status change (e.g. "Mark as Paid" / the quick
    // status dropdown) settles the invoice — the Record Payment flow and
    // the Stripe/Square webhook already notify for their own paths; this
    // covers the direct status-edit path, which previously notified no one.
    if (body.status === 'paid' && !wasAlreadyPaid) {
      const money = Number(invoice.amountPaid ?? invoice.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      const clientName = invoice.client?.name ?? 'client'
      notifyEvent('paid', {
        pushTitle: 'Invoice paid',
        pushBody:  `${money} — Invoice ${invoice.invoiceNumber} (${clientName}), marked paid by ${authUser.name}`,
        pushData:  { type: 'invoicePaid', invoiceId: invoice.id },
        emailSubject: `Invoice paid — ${invoice.invoiceNumber}`,
        emailHtml: `
          <p>An invoice was just marked paid.</p>
          <ul>
            <li><strong>Invoice:</strong> ${invoice.invoiceNumber}</li>
            <li><strong>Client:</strong> ${clientName}</li>
            <li><strong>Amount:</strong> ${money}</li>
            <li><strong>Marked paid by:</strong> ${authUser.name}</li>
          </ul>
        `,
      }).catch(err => console.error('Error notifying invoice paid:', err))
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
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

    // Desvincula los servicios facturados antes de borrar
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { select: { serviceId: true } } }
    })

    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Resetea invoicedAt de los servicios relacionados
    const serviceIds = invoice.items
      .map(i => i.serviceId)
      .filter(Boolean) as string[]

    if (serviceIds.length > 0) {
      await prisma.service.updateMany({
        where: { id: { in: serviceIds } },
        data:  { invoicedAt: null }
      })
    }

    // Borra el invoice (cascade borra items y payments)
    await prisma.invoice.delete({ where: { id } })

    logAudit(authUser, 'delete', 'invoice', id, {
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      status: invoice.status,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}