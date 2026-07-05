export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })
    if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(estimate)
  } catch (error) {
    console.error('GET /api/estimates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch estimate' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const {
      estimateNumber, issueDate, validUntil,
      clientName, clientEmail, clientPhone, clientAddress,
      notes, taxRate, subtotal, tax, total, items,
      clientId, status,
    } = body

    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        estimateNumber,
        issueDate:  issueDate  ? new Date(issueDate)  : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        clientName,
        clientEmail:   clientEmail   ?? null,
        clientPhone:   clientPhone   ?? null,
        clientAddress: clientAddress ?? null,
        notes:         notes         ?? null,
        taxRate:       taxRate  !== undefined ? Number(taxRate)  : undefined,
        subtotal:      subtotal !== undefined ? Number(subtotal) : undefined,
        tax:           tax      !== undefined ? Number(tax)      : undefined,
        total:         total    !== undefined ? Number(total)    : undefined,
        items:         items    !== undefined ? items            : undefined,
        clientId:      clientId || null,
        status:        status   || undefined,
      },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })
    return NextResponse.json(estimate)
  } catch (error: any) {
    console.error('PUT /api/estimates/[id] error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Estimate number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await prisma.estimate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/estimates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 })
  }
}
