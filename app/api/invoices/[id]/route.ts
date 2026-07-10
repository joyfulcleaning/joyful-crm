export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

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
    if (body.status === 'paid') {
      const current = await prisma.invoice.findUnique({ where: { id }, select: { total: true, paidAt: true } })
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

    const invoice = await prisma.invoice.update({ where: { id }, data: updateData })

    logAudit(authUser, 'update', 'invoice', invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      changes: updateData,
    })

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