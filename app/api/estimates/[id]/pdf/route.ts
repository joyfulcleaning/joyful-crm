export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateEstimatePDF, estimateDataFrom } from '@/lib/estimate-pdf'
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

    // ?lang= previews the other language without changing the estimate.
    const q = new URL(_req.url).searchParams.get('lang')
    const data = estimateDataFrom(est, q === 'es' || q === 'en' ? q : undefined)

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
