export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'

// POST /api/ai/estimate-visits
// Books an in-person visit to quote a prospective client. Independent of the
// Service scheduling grid on purpose — it doesn't compete for the same slot
// and isn't blocked by (or blocking to) an already-booked Service.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { clientId, name, phone, email, address, visitDate, visitTime, notes } = body

    if (!name || !visitDate || !visitTime) {
      return NextResponse.json({ error: 'name, visitDate and visitTime are required' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      return NextResponse.json({ error: 'visitDate must be YYYY-MM-DD' }, { status: 400 })
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
    })

    return NextResponse.json({
      success: true,
      visitId: visit.id,
      clientId: visit.clientId,
      visitDate,
      visitTime,
      address: visit.address,
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/ai/estimate-visits:', error)
    return NextResponse.json({ error: 'Failed to create estimate visit' }, { status: 500 })
  }
}
