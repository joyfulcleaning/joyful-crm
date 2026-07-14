'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Filler,
  Title, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { TrendingDown, DollarSign, Briefcase, Activity } from 'lucide-react'
import CountUp from '@/components/ui/CountUp'
import { useI18n } from '@/lib/i18n'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Title, Tooltip, Legend)

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


const _DOUGHNUT_R    = 92
const _DOUGHNUT_CIRC = +(2 * Math.PI * _DOUGHNUT_R).toFixed(2) // ≈ 578.05

function SVGDoughnut({
  labels, values, colors, showLegend = true, legendColor = '#9ca3af',
}: {
  labels: string[]; values: number[]; colors: string[]
  showLegend?: boolean; legendColor?: string
}) {
  const { t } = useI18n()
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <span style={{ fontSize: 11, color: '#6b7280' }}>{t.analyticsPage.noData}</span>
    </div>
  )
  let angle = -90
  const segs = labels.map((label, i) => {
    const frac = values[i] / total
    const arcLen = +(frac * _DOUGHNUT_CIRC).toFixed(2)
    const startDeg = +angle.toFixed(2)
    angle += frac * 360
    return { label, arcLen, startDeg, color: colors[i % colors.length], delay: +(0.1 + i * 0.13).toFixed(2) }
  }).filter(s => s.arcLen > 0.5)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 280 280" style={{ width: '100%', height: '100%' }}>
          <g fill="none" strokeWidth={46}>
            {segs.map((seg, i) => (
              <circle key={i} cx={140} cy={140} r={_DOUGHNUT_R} stroke={seg.color}
                style={{
                  transformOrigin: '140px 140px',
                  transform: `rotate(${seg.startDeg}deg)`,
                  strokeDasharray: `${seg.arcLen} ${_DOUGHNUT_CIRC}`,
                  strokeDashoffset: seg.arcLen,
                  animation: `caSegGrow .9s cubic-bezier(.45,.05,.35,1) ${seg.delay}s forwards`,
                } as any}
              />
            ))}
          </g>
        </svg>
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', paddingBottom: 2 }}>
          {segs.map((seg, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: legendColor, opacity: 0,
              animation: `caLegIn .4s ease ${0.8 + i * 0.07}s both`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0, display: 'inline-block' }} />
              {seg.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const { t } = useI18n()
  const [days,       setDays]       = useState(30)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [light, setLight] = useState(false)
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    setLight(document.body.classList.contains('light'))
    setThemeReady(true)
    const update = () => setLight(document.body.classList.contains('light'))
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

  const pluginBase = useMemo(() => ({
    legend: { labels: { color: chartMuted, font: { size: 10 }, boxWidth: 8, padding: 10 } },
    tooltip: {
      backgroundColor: chartBg,
      borderColor: chartBorder,
      borderWidth: 1,
      titleColor: chartText,
      bodyColor: chartMuted,
      padding: 8,
    },
  }), [chartMuted, chartBg, chartBorder, chartText])

  const scalesBase = useMemo(() => ({
    x: { ticks: { color: chartMuted, font: { size: 9 } }, grid: { color: chartGrid } },
    y: { ticks: { color: chartMuted, font: { size: 9 } }, grid: { color: chartGrid } },
  }), [chartMuted, chartGrid])

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
  const marginLabel = (kpi.netMargin || 0) >= 70 ? t.analyticsPage.excellent : (kpi.netMargin || 0) >= 40 ? t.analyticsPage.good : t.analyticsPage.needsFocus

  const rangeLabels: Record<string, string> = {
    '7D': t.analyticsPage.range7d,
    '30D': t.analyticsPage.range30d,
    '90D': t.analyticsPage.range90d,
    '1Y': t.analyticsPage.range1y,
    'Custom': t.analyticsPage.rangeCustom,
  }

  // ── Chart data ──
  const staffData = useMemo(() => data ? {
    labels: data.byStaff.length ? data.byStaff.map((s: any) => s.name.split(' ')[0]) : ['—'],
    datasets: [{
      label: t.analyticsPage.servicesLabel,
      data: data.byStaff.length ? data.byStaff.map((s: any) => s.count) : [0],
      backgroundColor: 'rgba(79,142,247,0.7)', borderColor: '#4f8ef7', borderWidth: 1, borderRadius: 4,
    }],
  } : null, [data])

  const staffBgData = useMemo(() => staffData ? {
    ...staffData,
    datasets: staffData.datasets.map((d: any) => ({ ...d, backgroundColor: 'transparent', borderColor: 'transparent' })),
  } : null, [staffData])

  const staffBgOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { ...pluginBase, legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: scalesBase.x, y: { ...scalesBase.y, ticks: { ...scalesBase.y.ticks, stepSize: 1 } } },
  }), [pluginBase, scalesBase])

  const staffOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { ...pluginBase, legend: { display: false } },
    scales: {
      x: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 } }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 }, stepSize: 1 }, grid: { display: false }, border: { display: false } },
    },
  }), [pluginBase])

  const weekData = useMemo(() => data ? {
    labels: data.weeklyVolume.map((v: any) => v.day),
    datasets: [{
      label: t.analyticsPage.servicesLabel,
      data: data.weeklyVolume.map((v: any) => v.count),
      backgroundColor: 'rgba(167,139,250,0.7)', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 4,
    }],
  } : null, [data])

  const weekBgData = useMemo(() => weekData ? {
    ...weekData,
    datasets: weekData.datasets.map((d: any) => ({ ...d, backgroundColor: 'transparent', borderColor: 'transparent' })),
  } : null, [weekData])

  const weekBgOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { ...pluginBase, legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: scalesBase.x, y: { ...scalesBase.y, ticks: { ...scalesBase.y.ticks, stepSize: 1 } } },
  }), [pluginBase, scalesBase])

  const weekOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { ...pluginBase, legend: { display: false } },
    scales: {
      x: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 } }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 }, stepSize: 1 }, grid: { display: false }, border: { display: false } },
    },
  }), [pluginBase])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">{t.nav.analytics}</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">{t.analyticsPage.subtitle}</p>
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
                {rangeLabels[r.label]}
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
              <span className="text-[#6b7280] text-xs">{t.analyticsPage.to}</span>
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
        <div className="text-center py-16 text-[#6b7280] text-sm">{t.analyticsPage.failedToLoad}</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: t.analyticsPage.totalRevenue, value: kpi.totalRevenue ?? 0, format: fmt,
                icon: DollarSign, color: green, border: 'border-t-[#38d9a9]',
                sub: t.analyticsPage.servicesThisPeriod(kpi.servicesCount ?? 0),
              },
              {
                label: t.analyticsPage.totalExpenses, value: kpi.totalExpenses ?? 0, format: fmt,
                icon: TrendingDown, color: '#f87171', border: 'border-t-[#f87171]',
                sub: t.analyticsPage.ofRevenue(pct(kpi.totalRevenue ? (kpi.totalExpenses / kpi.totalRevenue) * 100 : 0)),
              },
              {
                label: t.analyticsPage.netBalance, value: kpi.netBalance ?? 0, format: fmt,
                icon: Activity, color: '#4f8ef7', border: 'border-t-[#4f8ef7]',
                sub: t.analyticsPage.marginColon(pct(kpi.netMargin ?? 0)),
              },
              {
                label: t.analyticsPage.servicesDone, value: kpi.completedServices ?? 0, format: undefined,
                icon: Briefcase, color: '#a78bfa', border: 'border-t-[#a78bfa]',
                sub: t.analyticsPage.ofTotalCount(kpi.servicesCount ?? 0),
              },
            ].map((card, i) => (
              <div key={card.label}
                className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4 relative overflow-hidden`}
                style={{ animation: 'fadeSlideUp 0.4s ease both', animationDelay: `${i * 80}ms` }}
              >
                <card.icon size={18} className="absolute right-3 top-3 opacity-20" style={{ color: card.color }} />
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-2xl font-bold mt-1.5" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>
                  <CountUp value={card.value} format={card.format} />
                </div>
                <div className="text-[10px] text-[#6b7280] mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Row 1: Line + Service Type Donut ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.revenueVsExpenses}</div>
              <div style={{ height: 220 }}>
                {themeReady && data?.timeSeries?.labels?.length > 0 && (() => {
                  const pts = data.timeSeries.labels.length > 26 ? 0 : 3
                  const yTickCb = (v: any) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  const lineDatasets = [
                    {
                      label: t.analyticsPage.revenue, data: data.timeSeries.revenue,
                      borderColor: green, backgroundColor: greenBg, borderWidth: 2.5,
                      fill: true, tension: 0.4, pointRadius: pts, pointHoverRadius: 5,
                      pointBackgroundColor: green, pointBorderColor: chartBg, pointBorderWidth: 2,
                    },
                    {
                      label: t.analyticsPage.expenses, data: data.timeSeries.expenses,
                      borderColor: '#f87171', backgroundColor: 'transparent', borderWidth: 2,
                      borderDash: [5, 3], fill: false, tension: 0.4, pointRadius: pts, pointHoverRadius: 5,
                      pointBackgroundColor: '#f87171', pointBorderColor: chartBg, pointBorderWidth: 2,
                    },
                  ]
                  const legendCfg = { display: true, position: 'top' as const, align: 'start' as const, labels: { color: chartMuted, font: { size: 10 }, boxWidth: 12, padding: 12 } }
                  return (
                    <div key={`line-${light}-${days}-${data.timeSeries.labels.length}`} style={{ position: 'relative', height: '100%' }}>
                      {/* Background: grid + axes + legend */}
                      <div style={{ position: 'absolute', inset: 0 }}>
                        <Line
                          data={{ labels: data.timeSeries.labels, datasets: lineDatasets.map(d => ({ ...d, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, pointHoverRadius: 0 })) }}
                          options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: legendCfg, tooltip: { enabled: false } }, scales: { x: { ticks: { color: chartMuted, font: { size: 9 } }, grid: { color: chartGrid }, border: { display: false } }, y: { ticks: { color: chartMuted, font: { size: 9 }, callback: yTickCb }, grid: { color: chartGrid }, border: { display: false } } } } as any}
                        />
                      </div>
                      {/* Foreground: lines animate left-to-right */}
                      <div style={{ position: 'absolute', inset: 0, animation: 'caWipe 1.5s cubic-bezier(.45,.05,.35,1) .2s both' }}>
                        <Line
                          data={{ labels: data.timeSeries.labels, datasets: lineDatasets }}
                          options={{ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: legendCfg, tooltip: pluginBase.tooltip }, scales: { x: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 } }, grid: { display: false }, border: { display: false } }, y: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 }, callback: yTickCb }, grid: { display: false }, border: { display: false } } } } as any}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.serviceTypes}</div>
              {data.servicesByType.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-[#6b7280]">{t.analyticsPage.noData}</div>
              ) : (
                <div style={{ height: 200 }}>
                  {themeReady && (
                    <SVGDoughnut
                      key={`type-${light}-${days}-${data.servicesByType.length}`}
                      labels={data.servicesByType.map((s: any) => s.type)}
                      values={data.servicesByType.map((s: any) => s.count)}
                      colors={PALETTE}
                      legendColor={chartMuted}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: By Staff + Weekly Volume ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.servicesByStaff}</div>
              {data.byStaff.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">{t.analyticsPage.noStaffData}</div>
              ) : (
                <div style={{ position: 'relative', height: 180 }}>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <Bar data={staffBgData as any} options={staffBgOptions as any} />
                  </div>
                  <div style={{ position: 'absolute', inset: 0, animation: 'caGrowUp 0.9s cubic-bezier(.45,.05,.35,1) .1s both' }}>
                    <Bar data={staffData as any} options={staffOptions as any} />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.weeklyVolume}</div>
              <div style={{ position: 'relative', height: 180 }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Bar data={weekBgData as any} options={weekBgOptions as any} />
                </div>
                <div style={{ position: 'absolute', inset: 0, animation: 'caGrowUp 0.9s cubic-bezier(.45,.05,.35,1) .1s both' }}>
                  <Bar data={weekData as any} options={weekOptions as any} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 3: Invoice Status + Top Clients + Expense Breakdown ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Invoice Status */}
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.invoiceStatus}</div>
              <div style={{ height: 110 }} className="mb-3">
                {themeReady && (
                  <SVGDoughnut
                    key={`inv-${light}-${days}-${data.invoiceStatus.paid + data.invoiceStatus.sent}`}
                    labels={[t.analyticsPage.paid, t.analyticsPage.pending, t.analyticsPage.overdue, t.analyticsPage.draft]}
                    values={[data.invoiceStatus.paid, data.invoiceStatus.sent, data.invoiceStatus.overdue, data.invoiceStatus.draft]}
                    colors={[green, '#4f8ef7', '#f87171', '#6b7280']}
                    showLegend={false}
                  />
                )}
              </div>
              {[
                { label: t.analyticsPage.paid, count: data.invoiceStatus.paid, color: green },
                { label: t.analyticsPage.pending, count: data.invoiceStatus.sent, color: '#4f8ef7' },
                { label: t.analyticsPage.overdue, count: data.invoiceStatus.overdue, color: '#f87171' },
                { label: t.analyticsPage.draft, count: data.invoiceStatus.draft, color: '#6b7280' },
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
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.topClients}</div>
              {data.topClients.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">{t.analyticsPage.noData}</div>
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
              <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.expensesBreakdown}</div>
              {data.expensesByCategory.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-[#6b7280]">{t.analyticsPage.noData}</div>
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
            <div className="text-xs font-bold text-[#e8eaf0] mb-4">{t.analyticsPage.financialReconciliation}</div>
            <div className="grid grid-cols-4 gap-5 mb-4">
              {[
                {
                  label: t.analyticsPage.totalInvoiced, value: rec.totalInvoiced ?? 0,
                  note: t.analyticsPage.fullPeriodInvoicing, color: '#4f8ef7',
                  pct: 100, gradient: false,
                },
                {
                  label: t.analyticsPage.collectedPaid, value: rec.totalCollected ?? 0,
                  note: t.analyticsPage.collectionRateNote(pct(rec.collectionRate ?? 0)), color: green,
                  pct: rec.totalInvoiced ? ((rec.totalCollected ?? 0) / rec.totalInvoiced) * 100 : 0,
                  gradient: false,
                },
                {
                  label: t.analyticsPage.totalExpenses, value: rec.totalExpenses ?? 0,
                  note: t.analyticsPage.ofInvoiced(pct(rec.totalInvoiced ? ((rec.totalExpenses ?? 0) / rec.totalInvoiced) * 100 : 0)),
                  color: '#f87171',
                  pct: rec.totalInvoiced ? ((rec.totalExpenses ?? 0) / rec.totalInvoiced) * 100 : 0,
                  gradient: false,
                },
                {
                  label: t.analyticsPage.netBalance, value: (rec.totalCollected ?? 0) - (rec.totalExpenses ?? 0),
                  note: t.analyticsPage.netMarginNote(pct(rec.margin ?? 0)), color: green,
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
                { label: t.analyticsPage.pending, value: fmt(rec.pending ?? 0), color: '#f59e0b' },
                { label: t.analyticsPage.overdue, value: fmt(rec.overdue ?? 0), color: '#f87171' },
                { label: t.analyticsPage.totalUnpaid, value: fmt(rec.totalUnpaid ?? 0), color: '#e8eaf0' },
                { label: t.analyticsPage.netMargin, value: pct(rec.margin ?? 0), color: marginColor },
                { label: t.analyticsPage.collectionRate, value: pct(rec.collectionRate ?? 0), color: (rec.collectionRate ?? 0) >= 90 ? green : (rec.collectionRate ?? 0) >= 70 ? '#f59e0b' : '#f87171' },
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
            <div className="text-xs font-bold text-[#e8eaf0] mb-3">{t.analyticsPage.periodSummary}</div>
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: t.dashboard.totalServices, value: String(kpi.servicesCount ?? 0), color: '#4f8ef7' },
                { label: t.dashboard.completed, value: String(kpi.completedServices ?? 0), color: green },
                { label: t.analyticsPage.avgPerService, value: kpi.servicesCount ? fmt(kpi.totalRevenue / kpi.servicesCount) : '$0', color: '#a78bfa' },
                { label: t.dashboard.activeClients, value: String(kpi.activeClients ?? 0), color: '#f59e0b' },
                { label: t.analyticsPage.invoicesPaid, value: String(data.invoiceStatus.paid), color: green },
                { label: t.analyticsPage.netMargin, value: pct(kpi.netMargin ?? 0), color: marginColor },
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
                icon: '📈', title: t.analyticsPage.revenueTrendTitle, accent: green,
                body: kpi.totalRevenue > 0
                  ? t.analyticsPage.revenueTrendBody(fmt(kpi.totalRevenue), kpi.servicesCount, days)
                  : t.analyticsPage.noRevenueData,
              },
              {
                icon: '💰', title: t.analyticsPage.expenseRatioTitle, accent: '#f59e0b',
                body: kpi.totalRevenue > 0
                  ? `${t.analyticsPage.expensesAreOfRevenue(pct((kpi.totalExpenses / kpi.totalRevenue) * 100))} ${kpi.netMargin >= 70 ? t.analyticsPage.excellentCostControl : kpi.netMargin >= 40 ? t.analyticsPage.goodEfficiency : t.analyticsPage.reviewHighCostAreas}`
                  : t.analyticsPage.addExpenseRecords,
              },
              {
                icon: '👥', title: t.analyticsPage.clientActivityTitle, accent: '#a78bfa',
                body: kpi.activeClients > 0
                  ? `${t.analyticsPage.activeClientsOnRecord(kpi.activeClients)} ${data.topClients.length > 0 ? t.analyticsPage.topEarner(data.topClients[0].name, fmt(data.topClients[0].total)) : ''}`
                  : t.analyticsPage.addClientsServices,
              },
              {
                icon: '🎯', title: t.analyticsPage.marginHealthTitle, accent: marginColor,
                body: `${t.analyticsPage.netMarginAt(pct(kpi.netMargin ?? 0), marginLabel)} ${(kpi.netMargin ?? 0) >= 70 ? t.analyticsPage.highlyProfitable : (kpi.netMargin ?? 0) >= 40 ? t.analyticsPage.roomForImprovement : t.analyticsPage.focusReducingCosts}`,
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
                <div className="text-xs font-bold text-[#e8eaf0]">{t.analyticsPage.businessValuationReport}</div>
                <div className="text-[10px] text-[#6b7280] mt-0.5">{t.analyticsPage.estimatedFromLast12Months}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#6b7280]">{t.analyticsPage.estimatedRange}</div>
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
                    title={t.analyticsPage.midpoint(fmtK(val.midpoint ?? 0))}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[#6b7280] mt-1.5">
                  <span>{t.analyticsPage.low(fmtK(val.low ?? 0))}</span>
                  <span className="font-semibold text-[#38d9a9]">{t.analyticsPage.midpoint(fmtK(val.midpoint ?? 0))}</span>
                  <span>{t.analyticsPage.high(fmtK(val.high ?? 0))}</span>
                </div>
              </div>
            )}

            {/* Methods + Key Inputs */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div className="col-span-3 grid grid-cols-2 gap-3">
                {[
                  { method: t.analyticsPage.revenueMultiple, range: [val.revMultLow, val.revMultHigh], note: t.analyticsPage.revenueMultipleNote, color: '#4f8ef7' },
                  { method: t.analyticsPage.ebitdaMultiple, range: [val.ebitdaLow, val.ebitdaHigh], note: t.analyticsPage.ebitdaMultipleNote, color: '#a78bfa' },
                  { method: t.analyticsPage.sdeMethod, range: [val.sdeLow, val.sdeHigh], note: t.analyticsPage.sdeMethodNote, color: green },
                  { method: t.analyticsPage.assetBased, range: [val.assetBased, val.assetBased], note: t.analyticsPage.assetBasedNote, color: '#f59e0b' },
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
                <div className="text-[10px] font-bold text-[#e8eaf0] mb-2">{t.analyticsPage.keyInputs12mo}</div>
                {[
                  { label: t.analyticsPage.annualRevenue, value: fmt(val.annualRevenue ?? 0), color: green },
                  { label: t.analyticsPage.annualExpenses, value: fmt(val.annualExpenses ?? 0), color: '#f87171' },
                  { label: t.analyticsPage.netProfitEbitda, value: fmt(val.annualNet ?? 0), color: '#4f8ef7' },
                  { label: t.analyticsPage.totalAssetValue, value: fmt(val.totalAssetValue ?? 0), color: '#f59e0b' },
                  { label: t.analyticsPage.goodwillEstimate, value: fmt(val.goodwill ?? 0), color: '#a78bfa' },
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
                  icon: '✅', title: t.analyticsPage.positiveFactors, color: green,
                  bg: greenBg, border: light ? 'rgba(62,155,117,0.20)' : 'rgba(56,217,169,0.15)',
                  items: t.analyticsPage.positiveFactorsItems,
                },
                {
                  icon: '⚠️', title: t.analyticsPage.watchFactors, color: '#f59e0b',
                  bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.15)',
                  items: t.analyticsPage.watchFactorsItems,
                },
                {
                  icon: '🚀', title: t.analyticsPage.growthPotential, color: '#4f8ef7',
                  bg: 'rgba(79,142,247,0.05)', border: 'rgba(79,142,247,0.15)',
                  items: t.analyticsPage.growthPotentialItems,
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
                <div className="text-[10px] text-[#6b7280] mb-0.5">{t.analyticsPage.recommendedListingPrice}</div>
                <div className="text-3xl font-bold text-[#38d9a9]" style={{ fontFamily: 'var(--font-display)' }}>
                  {fmtK(val.recommended ?? 0)}
                </div>
              </div>
              <div className="text-[9px] text-[#6b7280] max-w-xs text-right leading-relaxed">
                {t.analyticsPage.valuationDisclaimer}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
