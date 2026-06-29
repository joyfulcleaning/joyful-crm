'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ChevronDown } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface WeekData { week: string; revenue: number; expenses: number; netIncome: number }

const CUR_YEAR = new Date().getFullYear()
const YEARS    = Array.from({ length: CUR_YEAR - 2025 }, (_, i) => 2026 + i)

function weekOriginFor(y: number): Date {
  const jan1 = new Date(`${y}-01-01T00:00:00Z`)
  return new Date(jan1.getTime() - jan1.getUTCDay() * 86400000)
}

function weekRange(origin: Date, idx: number): string {
  const s = new Date(origin.getTime() + idx * 7 * 86400000)
  const e = new Date(s.getTime() + 6 * 86400000)
  const sm = s.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const em = e.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const sd = s.getUTCDate(), ed = e.getUTCDate()
  return sm === em ? `${sm} ${sd}–${ed}` : `${sm} ${sd} – ${em} ${ed}`
}

export default function WeeklyGrowthChart() {
  const [light, setLight]           = useState(false)
  const [year, setYear]             = useState(CUR_YEAR)
  const [data, setData]             = useState<WeekData[]>([])
  const [loading, setLoading]       = useState(true)
  const [showMenu, setShowMenu]     = useState(false)
  const menuRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showMenu])

  const fetchData = useCallback(async (y: number) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/dashboard/weekly?year=${y}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch { setData([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(year) }, [year, fetchData])

  const green       = light ? '#2C7355'            : '#38d9a9'
  const chartBg     = light ? '#FFFFFF'            : '#161922'
  const chartBorder = light ? '#D3D7E0'            : '#2a2f3d'
  const chartText   = light ? '#1F1A3D'            : '#e8eaf0'
  const chartMuted  = light ? '#6B7280'            : '#6b7280'
  const chartGrid   = light ? '#E8EAF0'            : '#1e2330'

  const hasData = data.some(d => d.netIncome !== 0 || d.revenue !== 0)

  const labels = data.map((d, i) => i % 4 === 0 ? d.week : '')

  const chartData = {
    labels,
    datasets: [{
      label: 'Net Income',
      data: data.map(d => d.netIncome),
      borderColor: green,
      backgroundColor: light ? 'rgba(62,155,117,0.08)' : 'rgba(56,217,169,0.08)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: green,
      pointBorderColor: chartBg,
      pointBorderWidth: 2,
    }],
  }

  const yTickCb = (v: any) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
  const tooltip = {
    backgroundColor: chartBg, borderColor: chartBorder, borderWidth: 1,
    titleColor: chartText, bodyColor: chartMuted, padding: 10,
    callbacks: {
      title: (items: any[]) => {
        const i = items[0].dataIndex
        return `${data[i]?.week ?? ''}  ·  ${weekRange(weekOriginFor(year), i)}`
      },
      label: (ctx: any) => {
        const i   = ctx.dataIndex
        const rev = data[i]?.revenue  ?? 0
        const exp = data[i]?.expenses ?? 0
        const net = ctx.raw as number
        const fmtN = (n: number) => `${n >= 0 ? '$' : '-$'}${Math.abs(Math.round(n)).toLocaleString()}`
        return [`  Completed:   ${fmtN(rev)}`, `  Expenses:    ${fmtN(exp)}`, `  Net income:  ${fmtN(net)}`]
      },
    },
  }

  // Background layer: grid + axes appear immediately
  const bgOptions = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { ticks: { color: chartMuted, font: { size: 9 }, maxRotation: 0 }, grid: { color: chartGrid } },
      y: { ticks: { color: chartMuted, font: { size: 9 }, callback: yTickCb }, grid: { color: chartGrid } },
    },
  } as any

  // Foreground layer: lines only (axes invisible but keep same size for alignment)
  const fgOptions = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip },
    scales: {
      x: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: 'rgba(0,0,0,0)', font: { size: 9 }, callback: yTickCb }, grid: { display: false }, border: { display: false } },
    },
  } as any

  const bgData = {
    labels,
    datasets: chartData.datasets.map((d: any) => ({
      ...d, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, pointHoverRadius: 0,
    })),
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-rest,none)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Weekly Net Income Growth</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Completed Services − Expenses · per week · {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: green }} />
            <span className="text-xs text-[var(--muted)]">Net Income</span>
          </div>
          {/* Year selector */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[#4f8ef7] transition-all"
            >
              {year}
              <ChevronDown size={11} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden min-w-[70px]">
                {YEARS.map(y => (
                  <button
                    key={y}
                    onClick={() => { setYear(y); setShowMenu(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                      y === year
                        ? 'bg-[rgba(79,142,247,0.12)] text-[#4f8ef7]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-36 text-xs text-[var(--muted)]">Loading…</div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-36 text-xs text-[var(--muted)]">No data for {year}</div>
      ) : (
        <div key={data.length} style={{ position: 'relative', height: 156 }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Line data={bgData} options={bgOptions} />
          </div>
          <div style={{ position: 'absolute', inset: 0, animation: 'caWipe 1.5s cubic-bezier(.45,.05,.35,1) .2s both' }}>
            <Line data={chartData} options={fgOptions} />
          </div>
        </div>
      )}
    </div>
  )
}
