import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
