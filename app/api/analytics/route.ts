export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const now = new Date()

    let from: Date
    let to: Date
    let days: number

    const fromParam = searchParams.get('from')
    const toParam   = searchParams.get('to')
    if (fromParam && toParam) {
      from = new Date(`${fromParam}T00:00:00.000Z`)
      to   = new Date(`${toParam}T23:59:59.999Z`)
      days = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
    } else {
      days = Math.min(Math.max(parseInt(searchParams.get('days') || '30'), 7), 365)
      to   = now
      from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    }

    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    const [services, invoices, expenses, allClients, assets, yearServices, yearExpenses] = await Promise.all([
      prisma.service.findMany({
        where: { serviceDate: { gte: from, lte: to } },
        include: {
          client: { select: { name: true } },
          staff: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.invoice.findMany({
        where: { issuedAt: { gte: from, lte: to } },
        include: { client: { select: { name: true } } },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: from, lte: to } },
      }),
      prisma.client.findMany({ select: { status: true } }),
      prisma.asset.findMany({ select: { currentValue: true } }),
      prisma.service.findMany({
        where: { serviceDate: { gte: yearAgo } },
        select: { total: true },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: yearAgo } },
        select: { amount: true },
      }),
    ])

    // KPIs
    const totalRevenue = services.reduce((s, sv) => s + Number(sv.total), 0)
    const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.total), 0)
    const totalCollected = invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0)
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const netBalance = totalRevenue - totalExpenses
    const netMargin = totalRevenue > 0 ? (netBalance / totalRevenue) * 100 : 0
    const activeClients = allClients.filter(c => c.status === 'active').length
    const completedServices = services.filter(s => s.status === 'completed').length

    // Invoice breakdown
    const invoiceStatus = {
      paid: invoices.filter(i => i.status === 'paid').length,
      sent: invoices.filter(i => i.status === 'sent').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      draft: invoices.filter(i => i.status === 'draft').length,
    }
    const pendingBalance = invoices
      .filter(i => i.status === 'sent')
      .reduce((s, i) => s + Number(i.balanceDue), 0)
    const overdueBalance = invoices
      .filter(i => i.status === 'overdue')
      .reduce((s, i) => s + Number(i.balanceDue), 0)
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0

    // Services by type
    const typeMap = new Map<string, { count: number; total: number }>()
    services.forEach(s => {
      const cur = typeMap.get(s.type) ?? { count: 0, total: 0 }
      typeMap.set(s.type, { count: cur.count + 1, total: cur.total + Number(s.total) })
    })
    const servicesByType = [...typeMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.count - a.count)

    // By staff
    const staffMap = new Map<string, { count: number; total: number }>()
    services.forEach(s => {
      s.staff.forEach(ss => {
        const name = ss.user.name
        const cur = staffMap.get(name) ?? { count: 0, total: 0 }
        staffMap.set(name, { count: cur.count + 1, total: cur.total + Number(s.total) })
      })
    })
    const byStaff = [...staffMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Top clients
    const clientMap = new Map<string, { services: number; total: number }>()
    services.forEach(s => {
      const name = s.client.name
      const cur = clientMap.get(name) ?? { services: 0, total: 0 }
      clientMap.set(name, { services: cur.services + 1, total: cur.total + Number(s.total) })
    })
    const topClients = [...clientMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    // Expenses by category
    const catMap = new Map<string, number>()
    expenses.forEach(e => {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + Number(e.amount))
    })
    const expensesByCategory = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Weekly volume — Mon-Fri only, using UTC day to avoid timezone shift
    const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const weekDayUTC   = [1, 2, 3, 4, 5] // UTC: 1=Mon … 5=Fri
    const dayCounts    = [0, 0, 0, 0, 0]
    services.forEach(s => {
      const utcDay = new Date(s.serviceDate).getUTCDay()
      const idx = weekDayUTC.indexOf(utcDay)
      if (idx !== -1) dayCounts[idx]++
    })
    const weeklyVolume = weekDayNames.map((day, i) => ({ day, count: dayCounts[i] }))

    // Time series
    const tsPoints: { label: string; revenue: number; expenses: number }[] = []
    if (days <= 30) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(to); d.setDate(d.getDate() - i)
        const utcDay = d.getUTCDay()
        if (utcDay === 0 || utcDay === 6) continue // skip weekends
        const dateStr = d.toISOString().split('T')[0]
        const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
        const rev = services.filter(s => new Date(s.serviceDate).toISOString().split('T')[0] === dateStr)
          .reduce((sum, s) => sum + Number(s.total), 0)
        const exp = expenses.filter(e => new Date(e.expenseDate).toISOString().split('T')[0] === dateStr)
          .reduce((sum, e) => sum + Number(e.amount), 0)
        tsPoints.push({ label, revenue: rev, expenses: exp })
      }
    } else if (days <= 90) {
      const weeks = Math.ceil(days / 7)
      for (let w = weeks - 1; w >= 0; w--) {
        const wEnd = new Date(to.getTime() - w * 7 * 24 * 60 * 60 * 1000)
        const wStart = new Date(wEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
        const label = `W${weeks - w}`
        const rev = services.filter(s => { const d = new Date(s.serviceDate); return d >= wStart && d <= wEnd })
          .reduce((sum, s) => sum + Number(s.total), 0)
        const exp = expenses.filter(e => { const d = new Date(e.expenseDate); return d >= wStart && d <= wEnd })
          .reduce((sum, e) => sum + Number(e.amount), 0)
        tsPoints.push({ label, revenue: rev, expenses: exp })
      }
    } else {
      const totalMonths = Math.ceil(days / 30)
      for (let m = totalMonths - 1; m >= 0; m--) {
        const md = new Date(to.getFullYear(), to.getMonth() - m, 1)
        const ym = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`
        const label = md.toLocaleString('en-US', { month: 'short' })
        const rev = services.filter(s => new Date(s.serviceDate).toISOString().slice(0, 7) === ym)
          .reduce((sum, s) => sum + Number(s.total), 0)
        const exp = expenses.filter(e => new Date(e.expenseDate).toISOString().slice(0, 7) === ym)
          .reduce((sum, e) => sum + Number(e.amount), 0)
        tsPoints.push({ label, revenue: rev, expenses: exp })
      }
    }

    const timeSeries = {
      labels: tsPoints.map(p => p.label),
      revenue: tsPoints.map(p => p.revenue),
      expenses: tsPoints.map(p => p.expenses),
    }

    // Business valuation (12 months)
    const annualRevenue = yearServices.reduce((s, sv) => s + Number(sv.total), 0)
    const annualExpenses = yearExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const annualNet = annualRevenue - annualExpenses
    const totalAssetValue = assets.reduce((s, a) => s + Number(a.currentValue), 0)
    const goodwill = Math.max(annualNet, 0) * 0.5

    const revMultLow = annualRevenue * 0.8
    const revMultHigh = annualRevenue * 1.5
    const ebitdaLow = Math.max(annualNet, 0) * 2
    const ebitdaHigh = Math.max(annualNet, 0) * 3
    const sdeLow = Math.max(annualNet, 0) * 1.5
    const sdeHigh = Math.max(annualNet, 0) * 3
    const assetBased = totalAssetValue + goodwill

    const candidates = [revMultLow, ebitdaLow, sdeLow, assetBased].filter(v => v > 0)
    const low = candidates.length ? Math.min(...candidates) : 0
    const high = Math.max(revMultHigh, ebitdaHigh, sdeHigh, assetBased)
    const midpoint = (low + high) / 2

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString(), days },
      kpi: {
        totalRevenue, totalInvoiced, totalCollected, totalExpenses, netBalance,
        netMargin, activeClients, completedServices, servicesCount: services.length,
      },
      timeSeries,
      servicesByType,
      byStaff,
      invoiceStatus,
      weeklyVolume,
      topClients,
      expensesByCategory,
      reconciliation: {
        totalInvoiced,
        totalCollected,
        totalExpenses,
        netBalance: totalCollected - totalExpenses,
        pending: pendingBalance,
        overdue: overdueBalance,
        totalUnpaid: pendingBalance + overdueBalance,
        margin: netMargin,
        collectionRate,
      },
      valuation: {
        annualRevenue, annualExpenses, annualNet, totalAssetValue, goodwill,
        revMultLow, revMultHigh, ebitdaLow, ebitdaHigh, sdeLow, sdeHigh, assetBased,
        low, high, midpoint, recommended: midpoint,
      },
    })
  } catch (error) {
    console.error('GET /api/analytics:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
