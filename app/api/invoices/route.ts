export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    // Busca el usuario por sesión o fallback admin
    const user = await prisma.user.findUnique({
      where: { email: session?.user?.email || 'admin@joyfulcleaning.com' }
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })

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

    return NextResponse.json(invoice)
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    if (error?.code === 'P2002' && error?.meta?.target?.includes('invoiceNumber')) {
      return NextResponse.json({ error: `Invoice number already exists. Choose a different number.` }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}