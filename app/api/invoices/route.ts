export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Auto-transition sent invoices past their dueDate to overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.invoice.updateMany({
      where: { status: 'sent', dueDate: { lt: today, not: null } },
      data:  { status: 'overdue' },
    })

    const invoices = await prisma.invoice.findMany({
      include: {
        client: { select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, propertyCode: true } },
        items: {
          include: {
            service: {
              select: {
                serviceNumber: true,
                serviceDate: true,
                type: true,
                unit: true,
                roomSize: true,
                additionalFee: true,
              }
            }
          }
        },
      },
      orderBy: { issuedAt: 'desc' }
    })
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('GET /api/invoices:', error)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    // Prevent duplicate invoicing: reject if any service is already linked to another invoice
    const incomingServiceIds = (body.items || []).map((i: any) => i.serviceId).filter(Boolean) as string[]
    if (incomingServiceIds.length > 0) {
      const alreadyInvoiced = await prisma.invoiceItem.findFirst({
        where: { serviceId: { in: incomingServiceIds } },
        include: { invoice: { select: { invoiceNumber: true } } }
      })
      if (alreadyInvoiced) {
        const num = alreadyInvoiced.invoice?.invoiceNumber ?? 'another invoice'
        return NextResponse.json(
          { error: `One or more services are already invoiced in ${num}. Delete that invoice first or deselect those services.` },
          { status: 409 }
        )
      }

      // A cancelled service was never actually performed — it should never be billable.
      const cancelledCount = await prisma.service.count({
        where: { id: { in: incomingServiceIds }, status: 'cancelled' },
      })
      if (cancelledCount > 0) {
        return NextResponse.json(
          { error: 'One or more selected services are cancelled and cannot be invoiced. Deselect them and try again.' },
          { status: 409 }
        )
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber,
        invoiceMode:   body.invoiceMode || 'auto',
        client:        { connect: { id: body.clientId } },
        createdBy:     { connect: { id: user.id } },
        periodFrom:    new Date(body.periodFrom),
        periodTo:      new Date(body.periodTo),
        subtotal:      body.subtotal,
        additionalFees: body.additionalFees || 0,
        taxRate:       body.taxRate   || 0,
        taxAmount:     body.taxAmount || 0,
        total:         body.total,
        paymentMethod: body.paymentMethod || null,
        status:        body.status || 'draft',
        dueDate:       body.dueDate ? new Date(body.dueDate) : null,
        notes:         body.notes,
        issuedAt:      new Date((body.issuedAt ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })) + 'T12:00:00.000Z'),
        // ── Crea los items con serviceId ──
        items: {
          create: body.items?.map((item: any) => ({
            description: item.description,
            quantity:    item.quantity || 1,
            unitPrice:   item.unitPrice,
            total:       item.total,
            serviceId:   item.serviceId || null,
          })) || []
        }
      },
      // Devuelve todo completo para el PDF modal
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
      }
    })

    // Mark each linked service as invoiced
    const serviceIds = (body.items || [])
      .map((item: any) => item.serviceId)
      .filter(Boolean) as string[]
    if (serviceIds.length > 0) {
      await prisma.service.updateMany({
        where: { id: { in: serviceIds } },
        data:  { invoicedAt: new Date() },
      })
    }

    logAudit(user, 'create', 'invoice', invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      client: invoice.client?.name,
      total: invoice.total,
      status: invoice.status,
    })

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      if (Array.isArray(target) ? target.includes('invoiceNumber') : String(target).includes('invoiceNumber')) {
        return NextResponse.json({ error: `Invoice number already exists. Choose a different number.` }, { status: 409 })
      }
      // DB-level guard: catches the race the findFirst check above can miss when
      // two requests invoice the same service at the same time.
      return NextResponse.json(
        { error: 'One or more services were just invoiced by another request. Refresh and try again.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}