export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())

  const start = new Date(`${year}-01-01T00:00:00Z`)
  const end   = new Date(`${year}-12-31T23:59:59Z`)

  const [paidInvoices, expenses] = await Promise.all([
    // Group paid invoices by their paidAt date
    prisma.invoice.findMany({
      where: { status: 'paid', paidAt: { gte: start, lte: end } },
      select: { paidAt: true, amountPaid: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: start, lte: end } },
      select: { expenseDate: true, amount: true },
    }),
  ])

  const monthPaid    = new Array(12).fill(0)
  const monthExpense = new Array(12).fill(0)

  for (const p of paidInvoices) {
    if (!p.paidAt) continue
    const m = new Date(p.paidAt).getUTCMonth()
    monthPaid[m] += Number(p.amountPaid)
  }
  for (const e of expenses) {
    const m = new Date(e.expenseDate).getUTCMonth()
    monthExpense[m] += Number(e.amount)
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const data = MONTHS.map((month, i) => ({
    month,
    invoicedPaid: monthPaid[i],
    expenses:     monthExpense[i],
    netIncome:    monthPaid[i] - monthExpense[i],
  }))

  return NextResponse.json(data)
}
