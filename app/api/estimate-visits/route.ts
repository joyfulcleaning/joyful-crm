export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
    })
    return NextResponse.json(visits)
  } catch (error) {
    console.error('GET /api/estimate-visits error:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { clientId, name, phone, email, address, visitDate, visitTime, notes } = body

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
      },
      include: { client: { select: { id: true, name: true } } },
    })
    return NextResponse.json(visit)
  } catch (error) {
    console.error('POST /api/estimate-visits error:', error)
    return NextResponse.json({ error: 'Failed to create estimate visit' }, { status: 500 })
  }
}
