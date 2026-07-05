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
    const to = searchParams.get('to')
    const status = searchParams.get('status')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    // serviceDate is a @db.Date column — Prisma round-trips it as UTC midnight
    // of the calendar date, so both bounds must be anchored to UTC explicitly.
    // Mixing a bare `new Date(from)` (UTC) with a local-time string for `to`
    // let the server's timezone (America/New_York) push the upper bound past
    // midnight UTC, pulling in the next day's services.
    const where: Record<string, any> = {
      serviceDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    }
    if (status && status !== 'all') {
      where.status = status
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            managementId: true,
          },
        },
        invoiceItems: {
          select: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
        },
      },
      orderBy: [{ serviceDate: 'asc' }, { serviceNumber: 'asc' }],
    })

    // Fetch client billing defaults separately to avoid issues with Prisma client cache
    const clientIds = [...new Set(services.map((s: any) => s.clientId))]
    let clientsWithDefaults: any[] = []
    if (clientIds.length > 0) {
      // id is TEXT in PostgreSQL (Prisma String → text), no ::uuid cast needed
      const placeholders = clientIds.map((_: any, i: number) => `$${i + 1}`).join(', ')
      clientsWithDefaults = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "paymentTermsDays", "defaultTaxRate", "defaultPaymentMethod" FROM clients WHERE id IN (${placeholders})`,
        ...clientIds
      ).catch((e: any) => { console.error('[clients-by-period] billing defaults query failed:', e); return [] })
    }
    const defaultsMap = new Map(clientsWithDefaults.map((c: any) => [c.id, c]))

    // Group services by client
    const clientMap = new Map<string, { client: any; services: any[] }>()

    for (const service of services) {
      const clientId = service.clientId
      if (!clientMap.has(clientId)) {
        const defaults = defaultsMap.get(clientId) || {}
        clientMap.set(clientId, {
          client: {
            ...service.client,
            paymentTermsDays: defaults.paymentTermsDays ?? null,
            defaultTaxRate: defaults.defaultTaxRate ?? null,
            defaultPaymentMethod: defaults.defaultPaymentMethod ?? null,
          },
          services: []
        })
      }
      clientMap.get(clientId)!.services.push(service)
    }

    // Build result array sorted by client name
    const result = Array.from(clientMap.values())
      .sort((a, b) => a.client.name.localeCompare(b.client.name))
      .map(({ client, services }) => ({
        client,
        services,
        totalCount: services.length,
        uninvoicedCount: services.filter((s: any) => !s.invoicedAt).length,
      }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching clients by period:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}
