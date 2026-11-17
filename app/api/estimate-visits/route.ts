export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { asLang, ESTIMATE_SUMMARY } from '@/lib/estimate-flow'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Estimate visits are the office's to confirm; staff never see them. An
    // empty list (not a 403) keeps older app builds, which fetch this for
    // everyone alongside the services, loading their calendar.
    if (authUser.role !== 'admin') return NextResponse.json([])

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    const where = from && to ? {
      visitDate: {
        gte: new Date(from + 'T00:00:00.000Z'),
        lte: new Date(to   + 'T23:59:59.999Z'),
      }
    } : {}

    const visits = await prisma.estimateVisit.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        // Enough of the linked estimate for the calendar card to show where
        // the visit stands (quote ready, sent, seen, accepted…) and its total.
        estimate: { select: ESTIMATE_SUMMARY },
      },
      orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
    })
    return NextResponse.json(visits)
  } catch (error) {
    console.error('GET /api/estimate-visits error:', error)
    return NextResponse.json({ error: 'Failed to load estimate visits' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { clientId, name, phone, email, address, visitDate, visitTime, notes, lang } = body

    if (!name || !visitDate || !visitTime) {
      return NextResponse.json({ error: 'name, visitDate and visitTime are required' }, { status: 400 })
    }

    const visit = await prisma.estimateVisit.create({
      data: {
        clientId: clientId || null,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        visitDate: new Date(`${visitDate}T00:00:00.000Z`),
        visitTime,
        notes: notes || null,
        lang: asLang(lang),
      },
      include: { client: { select: { id: true, name: true } } },
    })
    return NextResponse.json(visit)
  } catch (error) {
    console.error('POST /api/estimate-visits error:', error)
    return NextResponse.json({ error: 'Failed to create estimate visit' }, { status: 500 })
  }
}
