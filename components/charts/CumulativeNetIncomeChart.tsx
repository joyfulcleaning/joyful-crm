'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ChevronDown } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface WeekData { week: string; netIncome: number }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const CUR_YEAR = new Date().getFullYear()
const YEARS    = Array.from({ length: CUR_YEAR - 2025 }, (_, i) => 2026 + i)

export default function CumulativeNetIncomeChart() {
  const [light, setLight]       = useState(false)
  const [year, setYear]         = useState(CUR_YEAR)
  const [raw, setRaw]           = useState<WeekData[]>([])
  const [loading, setLoading]   = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef                 = useRef<HTMLDivElement>(null)

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
      setRaw(Array.isArray(json) ? json : [])
    } catch { setRaw([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(year) }, [year, fetchData])

  // Build cumulative totals
  let running = 0
  const cumulative  = raw.map(d => { running += d.netIncome; return running })
  const weekDeltas  = raw.map(d => d.netIncome)
  const totalNow    = cumulative[cumulative.length - 1] ?? 0
  const allZero     = cumulative.every(v => v === 0)

  const color     = light ? '#4A3FB0'              : '#a78bfa'
  const colorFill = light ? 'rgba(74,63,176,0.12)' : 'rgba(167,139,250,0.12)'
  const chartBg   = light ? '#FFFFFF'              : '#161922'
  const border    = light ? '#D3D7E0'              : '#2a2f3d'
  const textColor = light ? '#1F1A3D'              : '#e8eaf0'
  const muted     = light ? '#6b7280'              : '#6b7280'
  const grid      = light ? '#E8EAF0'              : '#1e2330'

  // Thin x-axis labels every 4 weeks
  const labels = raw.map((d, i) => i % 4 === 0 ? d.week : '')

  const chartData = {
    labels,
    datasets: [{
      label: 'Cumulative Net Income',
      data: cumulative,
      borderColor: color,
      backgroundColor: colorFill,
      pointBackgroundColor: color,
      pointBorderColor: chartBg,
      pointBorderWidth: 2,
      pointRadius: raw.length > 26 ? 0 : 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      tension: 0.4,
      fill: { target: 'origin', above: colorFill, below: 'rgba(248,113,113,0.08)' },
    }],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartBg,
        borderColor: border,
        borderWidth: 1,
        titleColor: textColor,
        bodyColor: muted,
        padding: 10,
        callbacks: {
          title: (items: any[]) => raw[items[0].dataIndex]?.week ?? '',
          label: (ctx: any) => {
            const i       = ctx.dataIndex
            const weekly  = weekDeltas[i]
            const cum     = ctx.parsed.y
            const rev     = raw[i]?.revenue  ?? 0
            const exp     = raw[i]?.expenses ?? 0
            return [
              `  Completed:   ${fmt(rev)}`,
              `  Expenses:    ${fmt(exp)}`,
              `  Net income:  ${fmt(weekly)}`,
              `  Cumulative:  ${fmt(cum)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: grid },
        ticks: { color: muted, font: { size: 9 }, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        grid: { color: grid },
        ticks: {
          color: muted,
          font: { size: 9 },
          callback: (v: number) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`,
        },
        border: { display: false },
      },
    },
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-rest,none)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-[var(--text)]">Cumulative Net Income</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">Running total accumulated by week — {year}</div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !allZero && (
            <div className="text-right">
              <div className="text-xs text-[var(--muted)]">Total accumulated</div>
              <div className="text-base font-bold mt-0.5" style={{ color }}>{fmt(totalNow)}</div>
            </div>
          )}
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
        <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">Loading…</div>
      ) : allZero ? (
        <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">No data for {year}</div>
      ) : (
        <div style={{ height: 200 }}>
          <Line data={chartData} options={options} />
        </div>
      )}
    </div>
  )
}
