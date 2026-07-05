export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateEstimatePDF, EstimateData } from '@/lib/estimate-pdf'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const est = await prisma.estimate.findUnique({ where: { id } })
    if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rawItems = Array.isArray(est.items) ? est.items as any[] : []
    const items = rawItems.map((it: any) => ({
      description: it.description ?? '',
      qty:         Number(it.qty ?? 1),
      unitPrice:   Number(it.unitPrice ?? it.unit_price ?? 0),
      total:       Number(it.total ?? (Number(it.qty ?? 1) * Number(it.unitPrice ?? it.unit_price ?? 0))),
    }))

    const data: EstimateData = {
      estimateNumber: est.estimateNumber,
      issueDate:      est.issueDate?.toISOString() ?? '',
      validUntil:     est.validUntil?.toISOString() ?? '',
      clientName:     est.clientName ?? '',
      clientEmail:    est.clientEmail ?? '',
      clientPhone:    est.clientPhone ?? '',
      clientAddress:  est.clientAddress ?? '',
      notes:          est.notes ?? '',
      taxRate:        Number(est.taxRate),
      subtotal:       Number(est.subtotal),
      tax:            Number(est.tax),
      total:          Number(est.total),
      items,
    }

    const pdf = await generateEstimatePDF(data)

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Estimate-${est.estimateNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/estimates/[id]/pdf error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
