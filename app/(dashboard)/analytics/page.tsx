'use client'

import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { TrendingDown, DollarSign, Briefcase, Activity } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler)

const RANGE = [
  { label: '7D',     days: 7   },
  { label: '30D',    days: 30  },
  { label: '90D',    days: 90  },
  { label: '1Y',     days: 365 },
  { label: 'Custom', days: 0   },
]

const PALETTE = ['#4A3FB0', '#38d9a9', '#a78bfa', '#f59e0b', '#f87171', '#fb923c']

const fmt = (n: number) => '$' + Math.round(n).toLocaleString()
const pct = (n: number, d = 1) => n.toFixed(d) + '%'
const fmtK = (n: number) => {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function Bar2({ value, max, color, h = 'h-1.5' }: { value: number; max: number; color: string; h?: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={`w-full bg-[#0d0f14] rounded-full ${h}`}>
      <div className={`${h} rounded-full transition-all`} style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl h-64 animate-pulse" />
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl h-64 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl h-52 animate-pulse" />
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl h-52 animate-pulse" />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [days,       setDays]       = useState(30)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [light, setLight] = useState(false)

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  const chartBg     = light ? '#FFFFFF'  : '#161922'
  const chartBorder = light ? '#D3D7E0'  : '#2a2f3d'
  const chartText   = light ? '#1F1A3D'  : '#e8eaf0'
  const chartMuted  = light ? '#6B7280'  : '#6b7280'
  const chartGrid   = light ? '#E8EAF0'  : '#1e2330'
  const green       = light ? '#2C7355'  : '#38d9a9'
  const greenBg     = light ? 'rgba(62,155,117,0.08)' : 'rgba(56,217,169,0.08)'
  const greenFill   = light ? 'rgba(62,155,117,0.12)' : 'rgba(56,217,169,0.12)'

  const pluginBase = {
    legend: { labels: { color: chartMuted, font: { size: 10 }, boxWidth: 8, padding: 10 } },
    tooltip: {
      backgroundColor: chartBg,
      borderColor: chartBorder,
      borderWidth: 1,
      titleColor: chartText,
      bodyColor: chartMuted,
      padding: 8,
    },
  }

  const scalesBase = {
    x: { ticks: { color: chartMuted, font: { size: 9 } }, grid: { color: chartGrid } },
    y: { ticks: { color: chartMuted, font: { size: 9 } }, grid: { color: chartGrid } },
  }

  const isCustom = days === 0

  useEffect(() => {
    if (isCustom && (!customFrom || !customTo)) return
    setLoading(true)
    const url = isCustom
      ? `/api/analytics?from=${customFrom}&to=${customTo}`
      : `/api/analytics?days=${days}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days, customFrom, customTo, isCustom])

  const kpi = data?.kpi ?? {}
  const rec = data?.reconciliation ?? {}
  const val = data?.valuation ?? {}

  const marginColor = (kpi.netMargin || 0) >= 70 ? green : (kpi.netMargin || 0) >= 40 ? '#f59e0b' : '#f87171'
  const marginLabel = (kpi.netMargin || 0) >= 70 ? 'Excellent' : (kpi.netMargin || 0) >= 40 ? 'Good' : 'Needs Focus'

  // ── Chart data ──
  const lineData = data ? {
    labels: data.timeSeries.labels,
    datasets: [
      {
        label: 'Revenue', data: data.timeSeries.revenue,
        borderColor: green, backgroundColor: greenBg,
        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 2, pointBackgroundColor: green,
      },
      {
        label: 'Expenses', data: data.timeSeries.expenses,
        borderColor: '#f87171', backgroundColor: 'transparent',
        borderWidth: 2, borderDash: [5, 3], fill: false, tension: 0.4, pointRadius: 2, pointBackgroundColor: '#f87171',
      },
    ],
  } : null

  const typeData = data ? {
    labels: data.servicesByType.length ? data.servicesByType.map((s: any) => s.type) : ['No data'],
    datasets: [{
      data: data.servicesByType.length ? data.servicesByType.map((s: any) => s.count) : [1],
      backgroundColor: PALETTE.map(c => c + 'cc'),
      borderColor: 'transparent',
      borderWidth: 0,
    }],
  } : null

  const staffData = data ? {
    labels: data.byStaff.length ? data.byStaff.map((s: any) => s.name.split(' ')[0]) : ['—'],
    datasets: [{
      label: 'Services',
      data: data.byStaff.length ? data.byStaff.map((s: any) => s.count) : [0],
      backgroundColor: 'rgba(79,142,247,0.7)', borderColor: '#4f8ef7', borderWidth: 1, borderRadius: 4,
    }],
  } : null

  const weekData = data ? {
    labels: data.weeklyVolume.map((v: any) => v.day),
    datasets: [{
      label: 'Services',
      data: data.weeklyVolume.map((v: any) => v.count),
      backgroundColor: 'rgba(167,139,250,0.7)', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 4,
    }],
  } : null

  const invStatusData = data ? {
    labels: ['Paid', 'Pending', 'Overdue', 'Draft'],
    datasets: [{
      data: [data.invoiceStatus.paid, data.invoiceStatus.sent, data.invoiceStatus.overdue, data.invoiceStatus.draft],
      backgroundColor: ['rgba(56,217,169,0.8)', 'rgba(79,142,247,0.7)', 'rgba(248,113,113,0.8)', 'rgba(107,114,128,0.5)'],
      borderColor: [green, '#4f8ef7', '#f87171', '#6b7280'],
      borderWidth: 2,
    }],
  } : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">Analytics</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Business performance &amp; insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-[#161922] border border-[#2a2f3d] rounded-lg p-1">
            {RANGE.map(r => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  days === r.days ? 'bg-[#4f8ef7] text-white' : 'text-[#6b7280] hover:text-[#e8eaf0]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-[11px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
              />
              <span className="text-[#6b7280] text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-[11px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? <Skeleton /> : !data ? (
        <div className="text-center py-16 text-[#6b7280] text-sm">Failed to load analytics data.</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: 'Total Revenue', value: fmt(kpi.totalRevenue ?? 0),
                icon: DollarSign, color: green, border: 'border-t-[#38d9a9]',
                sub: `${kpi.servicesCount ?? 0} services this period`,
              },
              {
                label: 'Total Expenses', value: fmt(kpi.totalExpenses ?? 0),
                icon: TrendingDown, color: '#f87171', border: 'border-t-[#f87171]',
                sub: `${pct(kpi.totalRevenue ? (kpi.totalExpenses / kpi.totalRevenue) * 100 : 0)} of revenue`,
              },
              {
                label: 'Net Balance', value: fmt(kpi.netBalance ?? 0),
                icon: Activity, color: '#4f8ef7', border: 'border-t-[#4f8ef7]',
                sub: `Margin: ${pct(kpi.netMargin ?? 0)}`,
              },
              {
                label: 'Services Done', value: String(kpi.completedServices ?? 0),
                icon: Briefcase, color: '#a78bfa', border: 'border-t-[#a78bfa]',
                sub: `of ${kpi.servicesCount ?? 0} total`,
              },
            ].map(card => (
              <div key={card.label} className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4 relative overflow-hidden`}>
                <card.icon size={18} className="absolute right-3 top-3 opacity-20" style={{ color: card.color }} />
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-2xl font-bold mt-1.5" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>
                  {card.value}
                </div>
                <div className="text-[10px] text-[#6b7280] mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Row 1: Line + Service Type Donut ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Revenue vs Expenses</div>
              <div style={{ height: 220 }}>
                {lineData && (
                  <Line data={lineData as any} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { ...pluginBase, legend: { ...pluginBase.legend, position: 'top' } },
                    scales: {
                      x: scalesBase.x,
                      y: {
                        ...scalesBase.y,
                        ticks: { ...scalesBase.y.ticks, callback: (v: any) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}` },
                      },
                    },
                  } as any} />
                )}
              </div>
            </div>
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Service Types</div>
              {data.servicesByType.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-[#6b7280]">No data</div>
              ) : (
                <div style={{ height: 200 }}>
                  <Doughnut data={typeData as any} options={{
                    responsive: true, maintainAspectRatio: false, cutout: '55%',
                    plugins: { ...pluginBase, legend: { ...pluginBase.legend, position: 'bottom' } },
                  } as any} />
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: By Staff + Weekly Volume ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Services by Staff</div>
              {data.byStaff.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">No staff data</div>
              ) : (
                <div style={{ height: 180 }}>
                  <Bar data={staffData as any} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { ...pluginBase, legend: { display: false } },
                    scales: { x: scalesBase.x, y: { ...scalesBase.y, ticks: { ...scalesBase.y.ticks, stepSize: 1 } } },
                  } as any} />
                </div>
              )}
            </div>
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Weekly Volume</div>
              <div style={{ height: 180 }}>
                <Bar data={weekData as any} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { ...pluginBase, legend: { display: false } },
                  scales: { x: scalesBase.x, y: { ...scalesBase.y, ticks: { ...scalesBase.y.ticks, stepSize: 1 } } },
                } as any} />
              </div>
            </div>
          </div>

          {/* ── Row 3: Invoice Status + Top Clients + Expense Breakdown ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Invoice Status */}
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Invoice Status</div>
              <div style={{ height: 110 }} className="mb-3">
                <Doughnut data={invStatusData as any} options={{
                  responsive: true, maintainAspectRatio: false, cutout: '62%',
                  plugins: { ...pluginBase, legend: { display: false } },
                } as any} />
              </div>
              {[
                { label: 'Paid', count: data.invoiceStatus.paid, color: green },
                { label: 'Pending', count: data.invoiceStatus.sent, color: '#4f8ef7' },
                { label: 'Overdue', count: data.invoiceStatus.overdue, color: '#f87171' },
                { label: 'Draft', count: data.invoiceStatus.draft, color: '#6b7280' },
              ].map(item => {
                const total = (data.invoiceStatus.paid + data.invoiceStatus.sent + data.invoiceStatus.overdue + data.invoiceStatus.draft) || 1
                return (
                  <div key={item.label} className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[#9ca3af]">{item.label}</span>
                      <span style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <Bar2 value={item.count} max={total} color={item.color} />
                  </div>
                )
              })}
            </div>

            {/* Top Clients */}
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Top Clients</div>
              {data.topClients.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">No data</div>
              ) : (
                <div className="space-y-2.5">
                  {data.topClients.map((c: any, i: number) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: PALETTE[i % PALETTE.length] + '22', color: PALETTE[i % PALETTE.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[#e8eaf0] truncate mb-0.5">{c.name}</div>
                        <Bar2 value={c.total} max={data.topClients[0]?.total || 1} color={PALETTE[i % PALETTE.length]} />
                      </div>
                      <div className="text-[10px] font-semibold shrink-0" style={{ color: PALETTE[i % PALETTE.length] }}>
                        {fmt(c.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expense Breakdown */}
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">Expenses Breakdown</div>
              {data.expensesByCategory.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">No data</div>
              ) : (
                <div className="space-y-2.5">
                  {data.expensesByCategory.slice(0, 6).map((e: any, i: number) => (
                    <div key={e.category}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-[#9ca3af] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                          {e.category}
                        </span>
                        <span className="text-[#e8eaf0]">{fmt(e.amount)}</span>
                      </div>
                      <Bar2 value={e.amount} max={data.expensesByCategory[0]?.amount || 1} color={PALETTE[i % PALETTE.length]} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Financial Reconciliation ── */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-5">
            <div className="text-xs font-bold text-[#e8eaf0] mb-4">Financial Reconciliation</div>
            <div className="grid grid-cols-4 gap-5 mb-4">
              {[
                {
                  label: 'Total Invoiced', value: rec.totalInvoiced ?? 0,
                  note: '100% — full period invoicing', color: '#4f8ef7',
                  pct: 100, gradient: false,
                },
                {
                  label: 'Collected / Paid', value: rec.totalCollected ?? 0,
                  note: `${pct(rec.collectionRate ?? 0)} collection rate`, color: green,
                  pct: rec.totalInvoiced ? ((rec.totalCollected ?? 0) / rec.totalInvoiced) * 100 : 0,
                  gradient: false,
                },
                {
                  label: 'Total Expenses', value: rec.totalExpenses ?? 0,
                  note: `${pct(rec.totalInvoiced ? ((rec.totalExpenses ?? 0) / rec.totalInvoiced) * 100 : 0)} of invoiced`,
                  color: '#f87171',
                  pct: rec.totalInvoiced ? ((rec.totalExpenses ?? 0) / rec.totalInvoiced) * 100 : 0,
                  gradient: false,
                },
                {
                  label: 'Net Balance', value: (rec.totalCollected ?? 0) - (rec.totalExpenses ?? 0),
                  note: `${pct(rec.margin ?? 0)} net margin`, color: green,
                  pct: rec.totalInvoiced ? (((rec.totalCollected ?? 0) - (rec.totalExpenses ?? 0)) / rec.totalInvoiced) * 100 : 0,
                  gradient: true,
                },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-[10px] text-[#6b7280] mb-1">{item.label}</div>
                  <div className="text-xl font-bold mb-1.5" style={{ color: item.color, fontFamily: 'var(--font-display)' }}>
                    {fmt(item.value)}
                  </div>
                  <div className="w-full bg-[#0d0f14] rounded-full h-1.5 mb-1">
                    <div className="h-1.5 rounded-full" style={{
                      width: `${Math.min(Math.max(item.pct, 0), 100)}%`,
                      background: item.gradient ? `linear-gradient(90deg, #4A3FB0, ${green})` : item.color,
                    }} />
                  </div>
                  <div className="text-[9px] text-[#6b7280]">{item.note}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#2a2f3d] pt-3 grid grid-cols-5 gap-3">
              {[
                { label: 'Pending', value: fmt(rec.pending ?? 0), color: '#f59e0b' },
                { label: 'Overdue', value: fmt(rec.overdue ?? 0), color: '#f87171' },
                { label: 'Total Unpaid', value: fmt(rec.totalUnpaid ?? 0), color: '#e8eaf0' },
                { label: 'Net Margin', value: pct(rec.margin ?? 0), color: marginColor },
                { label: 'Collection Rate', value: pct(rec.collectionRate ?? 0), color: (rec.collectionRate ?? 0) >= 90 ? green : (rec.collectionRate ?? 0) >= 70 ? '#f59e0b' : '#f87171' },
              ].map(item => (
                <div key={item.label} className="text-center bg-[#0d0f14] rounded-lg py-2 px-3">
                  <div className="text-[9px] text-[#6b7280] uppercase tracking-wide mb-1">{item.label}</div>
                  <div className="text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Period Summary ── */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
            <div className="text-xs font-bold text-[#e8eaf0] mb-3">Period Summary</div>
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: 'Total Services', value: String(kpi.servicesCount ?? 0), color: '#4f8ef7' },
                { label: 'Completed', value: String(kpi.completedServices ?? 0), color: green },
                { label: 'Avg / Service', value: kpi.servicesCount ? fmt(kpi.totalRevenue / kpi.servicesCount) : '$0', color: '#a78bfa' },
                { label: 'Active Clients', value: String(kpi.activeClients ?? 0), color: '#f59e0b' },
                { label: 'Invoices Paid', value: String(data.invoiceStatus.paid), color: green },
                { label: 'Net Margin', value: pct(kpi.netMargin ?? 0), color: marginColor },
              ].map(stat => (
                <div key={stat.label} className="text-center p-3 bg-[#0d0f14] rounded-lg">
                  <div className="text-[9px] text-[#6b7280] uppercase tracking-wider mb-1.5">{stat.label}</div>
                  <div className="text-xl font-bold" style={{ color: stat.color, fontFamily: 'var(--font-display)' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Insight Cards ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                icon: '📈', title: 'Revenue Trend', accent: green,
                body: kpi.totalRevenue > 0
                  ? `Generated ${fmt(kpi.totalRevenue)} across ${kpi.servicesCount} services in the last ${days} days.`
                  : 'No revenue data recorded for this period yet.',
              },
              {
                icon: '💰', title: 'Expense Ratio', accent: '#f59e0b',
                body: kpi.totalRevenue > 0
                  ? `Expenses are ${pct((kpi.totalExpenses / kpi.totalRevenue) * 100)} of revenue. ${kpi.netMargin >= 70 ? 'Excellent cost control.' : kpi.netMargin >= 40 ? 'Good efficiency.' : 'Review high-cost areas.'}`
                  : 'Add expense records to track your cost ratio.',
              },
              {
                icon: '👥', title: 'Client Activity', accent: '#a78bfa',
                body: kpi.activeClients > 0
                  ? `${kpi.activeClients} active clients on record. ${data.topClients.length > 0 ? `Top earner: ${data.topClients[0].name} (${fmt(data.topClients[0].total)}).` : ''}`
                  : 'Add clients and services to see activity insights.',
              },
              {
                icon: '🎯', title: 'Margin Health', accent: marginColor,
                body: `Net margin at ${pct(kpi.netMargin ?? 0)} — ${marginLabel}. ${(kpi.netMargin ?? 0) >= 70 ? 'Business is highly profitable.' : (kpi.netMargin ?? 0) >= 40 ? 'There is room for improvement.' : 'Focus on reducing operating costs.'}`,
              },
            ].map(card => (
              <div key={card.title} className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4"
                style={{ borderTopColor: card.accent, borderTopWidth: 2 }}>
                <div className="text-xl mb-2">{card.icon}</div>
                <div className="text-xs font-bold text-[#e8eaf0] mb-1.5">{card.title}</div>
                <div className="text-[11px] text-[#6b7280] leading-relaxed">{card.body}</div>
              </div>
            ))}
          </div>

          {/* ── Business Valuation ── */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-[#e8eaf0]">Business Valuation Report</div>
                <div className="text-[10px] text-[#6b7280] mt-0.5">Estimated from last 12 months of financial performance</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#6b7280]">Estimated Range</div>
                <div className="text-lg font-bold text-[#e8eaf0]" style={{ fontFamily: 'var(--font-display)' }}>
                  {fmtK(val.low ?? 0)} — {fmtK(val.high ?? 0)}
                </div>
              </div>
            </div>

            {/* Range bar */}
            {(val.high ?? 0) > 0 && (
              <div className="mb-5">
                <div className="relative w-full h-3 bg-[#0d0f14] rounded-full">
                  <div className="absolute inset-0 h-3 rounded-full"
                    style={{ background: 'linear-gradient(90deg, rgba(79,142,247,0.25), rgba(56,217,169,0.25))' }} />
                  <div
                    className="absolute top-0 w-3.5 h-3.5 bg-white border-2 border-[#38d9a9] rounded-full shadow-lg"
                    style={{ left: '50%', transform: 'translateX(-50%) translateY(-12.5%)' }}
                    title={`Midpoint: ${fmtK(val.midpoint ?? 0)}`}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[#6b7280] mt-1.5">
                  <span>Low: {fmtK(val.low ?? 0)}</span>
                  <span className="font-semibold text-[#38d9a9]">Midpoint: {fmtK(val.midpoint ?? 0)}</span>
                  <span>High: {fmtK(val.high ?? 0)}</span>
                </div>
              </div>
            )}

            {/* Methods + Key Inputs */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div className="col-span-3 grid grid-cols-2 gap-3">
                {[
                  { method: 'Revenue Multiple', range: [val.revMultLow, val.revMultHigh], note: '0.8× – 1.5× annual revenue', color: '#4f8ef7' },
                  { method: 'EBITDA Multiple', range: [val.ebitdaLow, val.ebitdaHigh], note: '2× – 3× net profit', color: '#a78bfa' },
                  { method: 'SDE Method', range: [val.sdeLow, val.sdeHigh], note: '1.5× – 3× seller earnings', color: green },
                  { method: 'Asset-Based', range: [val.assetBased, val.assetBased], note: 'Assets + goodwill estimate', color: '#f59e0b' },
                ].map(m => (
                  <div key={m.method} className="bg-[#0d0f14] rounded-lg p-3">
                    <div className="text-[10px] font-bold mb-1" style={{ color: m.color }}>{m.method}</div>
                    <div className="text-sm font-bold text-[#e8eaf0]" style={{ fontFamily: 'var(--font-display)' }}>
                      {fmtK(m.range[0] ?? 0)}{m.range[1] !== m.range[0] ? ` – ${fmtK(m.range[1] ?? 0)}` : ''}
                    </div>
                    <div className="text-[9px] text-[#6b7280] mt-0.5">{m.note}</div>
                  </div>
                ))}
              </div>
              <div className="col-span-2 bg-[#0d0f14] rounded-lg p-3">
                <div className="text-[10px] font-bold text-[#e8eaf0] mb-2">Key Inputs (12 mo.)</div>
                {[
                  { label: 'Annual Revenue', value: fmt(val.annualRevenue ?? 0), color: green },
                  { label: 'Annual Expenses', value: fmt(val.annualExpenses ?? 0), color: '#f87171' },
                  { label: 'Net Profit (EBITDA)', value: fmt(val.annualNet ?? 0), color: '#4f8ef7' },
                  { label: 'Total Asset Value', value: fmt(val.totalAssetValue ?? 0), color: '#f59e0b' },
                  { label: 'Goodwill Estimate', value: fmt(val.goodwill ?? 0), color: '#a78bfa' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-1 border-b border-[#2a2f3d] last:border-0">
                    <span className="text-[10px] text-[#6b7280]">{row.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Drivers */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  icon: '✅', title: 'Positive Factors', color: green,
                  bg: greenBg, border: light ? 'rgba(62,155,117,0.20)' : 'rgba(56,217,169,0.15)',
                  items: ['Recurring client base', 'Strong net margin', 'Low overhead costs', 'Diverse service offerings'],
                },
                {
                  icon: '⚠️', title: 'Watch Factors', color: '#f59e0b',
                  bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)',
                  items: ['Seasonal demand patterns', 'Staff dependency risk', 'Local market competition', 'Single-market exposure'],
                },
                {
                  icon: '🚀', title: 'Growth Potential', color: '#4f8ef7',
                  bg: 'rgba(79,142,247,0.05)', border: 'rgba(79,142,247,0.15)',
                  items: ['Expand service territory', 'Add premium service tiers', 'Build digital presence', 'Explore franchise model'],
                },
              ].map(group => (
                <div key={group.title} className="rounded-lg p-3"
                  style={{ backgroundColor: group.bg, border: `1px solid ${group.border}` }}>
                  <div className="text-[10px] font-bold mb-2" style={{ color: group.color }}>
                    {group.icon} {group.title}
                  </div>
                  {group.items.map(item => (
                    <div key={item} className="text-[10px] text-[#9ca3af] flex items-start gap-1.5 mb-1">
                      <span className="mt-0.5 shrink-0" style={{ color: group.color }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Recommended */}
            <div className="bg-[#0d0f14] rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#6b7280] mb-0.5">Recommended Listing Price</div>
                <div className="text-3xl font-bold text-[#38d9a9]" style={{ fontFamily: 'var(--font-display)' }}>
                  {fmtK(val.recommended ?? 0)}
                </div>
              </div>
              <div className="text-[9px] text-[#6b7280] max-w-xs text-right leading-relaxed">
                This estimate is based on your financial performance data and standard valuation multiples.
                Consult a certified business broker or CPA for a formal valuation before listing.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
