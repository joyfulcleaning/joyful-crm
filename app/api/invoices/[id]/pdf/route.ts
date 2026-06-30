export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoicePDF, InvoiceData, InvoiceItemData } from '@/lib/invoice-pdf'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const raw = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, propertyCode: true } },
        items: {
          include: {
            service: { select: { serviceDate: true, serviceNumber: true, type: true, unit: true, roomSize: true } }
          },
        },
      },
    })
    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const inv = raw as any

    const items: InvoiceItemData[] = (inv.items ?? []).map((item: any) => ({
      description:      item.description ?? '',
      quantity:         item.quantity ?? 1,
      unitPrice:        Number(item.unitPrice),
      total:            Number(item.total),
      serviceDate:      item.service?.serviceDate ? new Date(item.service.serviceDate).toISOString() : null,
      serviceNumber:    item.service?.serviceNumber ?? null,
      serviceType:      item.service?.type         ?? null,
      serviceUnit:      item.service?.unit         ?? null,
      serviceRoomSize:  item.service?.roomSize     ?? null,
    }))

    const data: InvoiceData = {
      invoiceNumber:       inv.invoiceNumber,
      issuedAt:            inv.issuedAt ? new Date(inv.issuedAt).toISOString() : '',
      dueDate:             inv.dueDate  ? new Date(inv.dueDate).toISOString()  : null,
      periodFrom:          inv.periodFrom ? new Date(inv.periodFrom).toISOString() : null,
      periodTo:            inv.periodTo   ? new Date(inv.periodTo).toISOString()   : null,
      status:              inv.status,
      paidAt:              inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
      clientName:          inv.client?.name         ?? '',
      clientEmail:         inv.client?.email        ?? null,
      clientPhone:         inv.client?.phone        ?? null,
      clientAddress:       inv.client?.address      ?? null,
      clientCity:          inv.client?.city         ?? null,
      clientState:         inv.client?.state        ?? null,
      clientZip:           inv.client?.zip          ?? null,
      clientPropertyCode:  inv.client?.propertyCode ?? null,
      notes:               inv.notes ?? null,
      taxRate:             Number(inv.taxRate),
      subtotal:            Number(inv.subtotal),
      taxAmount:           Number(inv.taxAmount),
      additionalFees:      Number(inv.additionalFees),
      total:               Number(inv.total),
      items,
    }

    const pdf = await generateInvoicePDF(data)

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${inv.invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/invoices/[id]/pdf error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
