export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'
import { normalizePhone } from '@/lib/phone'

// GET /api/ai/clients?phone=
// Used by the Vapi assistant to identify the caller. Never returns pricing
// or financial data — only what's needed to confirm identity and schedule.
export async function GET(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) {
    return NextResponse.json({ error: 'phone query param is required' }, { status: 400 })
  }

  const target = normalizePhone(phone)
  if (target.length < 7) {
    return NextResponse.json({ found: false, clients: [] })
  }

  try {
    const candidates = await prisma.client.findMany({
      where: { OR: [{ phone: { not: null } }, { contactPhone: { not: null } }] },
      include: { management: { select: { name: true } } },
    })

    const matches = candidates.filter(c =>
      (c.phone && normalizePhone(c.phone) === target) ||
      (c.contactPhone && normalizePhone(c.contactPhone) === target)
    )

    const clients = matches.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      phone: c.phone,
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      frequency: c.frequency,
      managementName: c.management?.name ?? null,
    }))

    return NextResponse.json({ found: clients.length > 0, clients })
  } catch (error) {
    console.error('Error in /api/ai/clients:', error)
    return NextResponse.json({ error: 'Failed to search clients' }, { status: 500 })
  }
}
