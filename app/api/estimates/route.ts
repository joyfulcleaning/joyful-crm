export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const estimates = await prisma.estimate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })
    return NextResponse.json(estimates)
  } catch (error) {
    console.error('GET /api/estimates error:', error)
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      estimateNumber, issueDate, validUntil,
      clientName, clientEmail, clientPhone, clientAddress,
      notes, taxRate, subtotal, tax, total, items,
      clientId, visitDate, visitTime,
    } = body

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        issueDate:  new Date(issueDate),
        validUntil: new Date(validUntil),
        clientName,
        clientEmail:   clientEmail   || null,
        clientPhone:   clientPhone   || null,
        clientAddress: clientAddress || null,
        notes:         notes         || null,
        taxRate:       Number(taxRate)   || 0,
        subtotal:      Number(subtotal)  || 0,
        tax:           Number(tax)       || 0,
        total:         Number(total)     || 0,
        items:         items ?? [],
        clientId:      clientId         || null,
      },
      include: {
        client:  { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    })

    let estimateVisit = null
    if (visitDate) {
      estimateVisit = await prisma.estimateVisit.create({
        data: {
          clientId: estimate.clientId,
          name: estimate.clientName,
          phone: estimate.clientPhone,
          email: estimate.clientEmail,
          address: estimate.clientAddress,
          visitDate: new Date(`${visitDate}T00:00:00.000Z`),
          visitTime,
          estimateId: estimate.id,
        },
      })
    }

    return NextResponse.json({ ...estimate, estimateVisit })
  } catch (error: any) {
    console.error('POST /api/estimates error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Estimate number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error?.message ?? 'Failed to create estimate' }, { status: 500 })
  }
}
