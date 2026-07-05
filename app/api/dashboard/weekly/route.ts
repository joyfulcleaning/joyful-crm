export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(req: Request) {
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())

  const jan1        = new Date(`${year}-01-01T00:00:00Z`)
  const currentYear = new Date().getFullYear()
  const end         = year < currentYear
    ? new Date(`${year}-12-31T23:59:59Z`)
    : new Date()

  // Align to the Sunday on or before Jan 1 so weeks match the calendar (Sun–Sat)
  const msPerDay  = 24 * 60 * 60 * 1000
  const msPerWeek = 7 * msPerDay
  const jan1Day   = jan1.getUTCDay() // 0=Sun … 6=Sat
  const weekOrigin = new Date(jan1.getTime() - jan1Day * msPerDay)

  // Query from weekOrigin so services in the first partial week are included
  const queryStart = weekOrigin

  const [services, expenses, allServices] = await Promise.all([
    prisma.service.findMany({
      where: { status: 'completed', serviceDate: { gte: queryStart, lte: end } },
      select: { serviceDate: true, total: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: queryStart, lte: end } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.service.findMany({
      where: { serviceDate: { gte: queryStart, lte: end } },
      select: { serviceDate: true },
    }),
  ])

  const WEEKS = 53 // up to 53 Sun–Sat weeks can fit in a year
  const weekRevenue = new Array(WEEKS).fill(0)
  const weekExpense = new Array(WEEKS).fill(0)
  const weekCount   = new Array(WEEKS).fill(0)

  for (const s of services) {
    const idx = Math.min(WEEKS - 1, Math.floor((new Date(s.serviceDate).getTime() - weekOrigin.getTime()) / msPerWeek))
    if (idx >= 0) weekRevenue[idx] += Number(s.total)
  }
  for (const e of expenses) {
    const idx = Math.min(WEEKS - 1, Math.floor((new Date(e.expenseDate).getTime() - weekOrigin.getTime()) / msPerWeek))
    if (idx >= 0) weekExpense[idx] += Number(e.amount)
  }
  for (const s of allServices) {
    const idx = Math.min(WEEKS - 1, Math.floor((new Date(s.serviceDate).getTime() - weekOrigin.getTime()) / msPerWeek))
    if (idx >= 0) weekCount[idx]++
  }

  // How many complete (or partial) weeks fit between weekOrigin and end
  const maxWeek = Math.min(WEEKS, Math.floor((end.getTime() - weekOrigin.getTime()) / msPerWeek) + 1)

  const data = Array.from({ length: maxWeek }, (_, i) => ({
    week:      `W${i + 1}`,
    revenue:   weekRevenue[i],
    expenses:  weekExpense[i],
    netIncome: weekRevenue[i] - weekExpense[i],
    count:     weekCount[i],
  }))

  return NextResponse.json(data)
}
