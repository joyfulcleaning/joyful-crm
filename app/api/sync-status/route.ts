export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

function sig(agg: { _count: { _all: number }; _max: { updatedAt: Date | null } }) {
  return `${agg._count._all}-${agg._max.updatedAt?.getTime() ?? 0}`
}

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [services, expenses, invoices, clients, recurringExpenses, inventory, assets, estimateVisits, aiRequests, aiRequestsPending] = await Promise.all([
    prisma.service.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.expense.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.invoice.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.client.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.recurringExpense.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.inventoryProduct.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.asset.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.estimateVisit.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.aiRequest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.aiRequest.count({ where: { status: 'pending' } }),
  ])

  return NextResponse.json({
    services: sig(services),
    expenses: sig(expenses),
    invoices: sig(invoices),
    clients: sig(clients),
    recurringExpenses: sig(recurringExpenses),
    inventory: sig(inventory),
    assets: sig(assets),
    estimateVisits: sig(estimateVisits),
    aiRequests: sig(aiRequests),
    aiRequestsPending,
  })
}
