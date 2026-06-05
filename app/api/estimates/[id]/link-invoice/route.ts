export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const estimate = await prisma.estimate.update({
      where: { id },
      data:  { invoiceId, status: 'converted' },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })
    return NextResponse.json(estimate)
  } catch (error) {
    console.error('POST /api/estimates/[id]/link-invoice error:', error)
    return NextResponse.json({ error: 'Failed to link invoice' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const estimate = await prisma.estimate.update({
      where: { id },
      data:  { invoiceId: null, status: 'pending' },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })
    return NextResponse.json(estimate)
  } catch (error) {
    console.error('DELETE /api/estimates/[id]/link-invoice error:', error)
    return NextResponse.json({ error: 'Failed to unlink invoice' }, { status: 500 })
  }
}
