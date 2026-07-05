export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q           = searchParams.get('q') || ''
    const fromDate    = searchParams.get('from')
    const toDate      = searchParams.get('to')
    const clientId    = searchParams.get('clientId')

    // Busca invoices por número o cliente
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { client: { name: { contains: q, mode: 'insensitive' } } },
        ],
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: { select: { name: true, email: true } },
        items: {
          include: {
            service: {
              select: {
                serviceNumber: true,
                serviceDate:   true,
                type:          true,
                unit:          true,
                roomSize:      true,
              }
            }
          }
        },
        payments: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 20,
    })

    // Busca servicios por número en el rango de fechas
    const serviceWhere: any = {}
    if (fromDate) serviceWhere.serviceDate = { gte: new Date(fromDate) }
    if (toDate)   serviceWhere.serviceDate = { ...serviceWhere.serviceDate, lte: new Date(toDate) }
    if (clientId) serviceWhere.clientId = clientId
    if (q && !isNaN(parseInt(q.replace('#', '')))) {
      serviceWhere.serviceNumber = parseInt(q.replace('#', ''))
    }

    const services = await prisma.service.findMany({
      where: Object.keys(serviceWhere).length > 0 ? serviceWhere : undefined,
      include: {
        client:      { select: { name: true } },
        invoiceItems: {
          include: {
            invoice: {
              select: {
                id:            true,
                invoiceNumber: true,
                status:        true,
                issuedAt:      true,
              }
            }
          }
        }
      },
      orderBy: { serviceDate: 'desc' },
      take: 50,
    })

    // Marca los servicios que ya están en un invoice
    const servicesWithStatus = services.map(s => ({
      ...s,
      isInvoiced: s.invoiceItems.length > 0,
      invoiceRef: s.invoiceItems[0]?.invoice || null,
    }))

    return NextResponse.json({ invoices, services: servicesWithStatus })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}