export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payments = await prisma.invoicePayment.findMany({
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
    })
    return NextResponse.json(payments)
  } catch (error) {
    console.error('GET /api/invoice-payments:', error)
    return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 })
  }
}
