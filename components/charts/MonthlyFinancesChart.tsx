'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { ChevronDown } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface MonthData { month: string; invoicedPaid: number; expenses: number; netIncome: number }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const CUR_YEAR = new Date().getFullYear()
const YEARS    = Array.from({ length: CUR_YEAR - 2024 }, (_, i) => 2025 + i)

export default function MonthlyFinancesChart() {
  const [light, setLight]       = useState(false)
  const [year, setYear]         = useState(CUR_YEAR)
  const [data, setData]         = useState<MonthData[]>([])
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
      const res  = await fetch(`/api/dashboard/monthly?year=${y}`)
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch { setData([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(year) }, [year, fetchData])

  const hasData = data.some(d => d.invoicedPaid !== 0 || d.expenses !== 0)

  const chartBg   = light ? '#FFFFFF'   : '#161922'
  const border    = light ? '#D3D7E0'   : '#2a2f3d'
  const textColor = light ? '#1F1A3D'   : '#e8eaf0'
  const muted     = light ? '#6b7280'   : '#6b7280'
  const grid      = light ? '#E8EAF0'   : '#1e2330'

  const paidColor = light ? 'rgba(56,189,151,0.8)'  : 'rgba(56,217,169,0.75)'
  const expColor  = light ? 'rgba(248,113,113,0.8)' : 'rgba(248,113,113,0.75)'

  const chartData = {
    labels: data.map(d => d.month),
    datasets: [
      {
        label: 'Invoices Paid',
        data: data.map(d => d.invoicedPaid),
        backgroundColor: paidColor,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Expenses',
        data: data.map(d => d.expenses),
        backgroundColor: expColor,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
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
          title: (items: any[]) => data[items[0].dataIndex]?.month ?? '',
          label: (ctx: any) => {
            const i       = ctx.dataIndex
            const paid    = data[i]?.invoicedPaid ?? 0
            const exp     = data[i]?.expenses     ?? 0
            const net     = data[i]?.netIncome    ?? 0
            if (ctx.datasetIndex === 0) {
              return [
                `  Invoices paid: ${fmt(paid)}`,
                `  Expenses:      ${fmt(exp)}`,
                `  Net income:    ${fmt(net)}`,
              ]
            }
            return []
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: grid },
        ticks: { color: muted, font: { size: 10 } },
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
          <div className="text-sm font-bold text-[var(--text)]">Monthly Finances</div>
          <div className="text-xs text-[var(--muted)] mt-0.5">Collected − Expenses = Net Income · per month · {year}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: paidColor }} />
              <span className="text-xs text-[var(--muted)]">Invoices Paid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: expColor }} />
              <span className="text-xs text-[var(--muted)]">Expenses</span>
            </div>
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
        <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">Loading…</div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">No data for {year}</div>
      ) : (
        <div style={{ height: 200 }}>
          <Bar key={data.length} data={chartData} options={{ ...options, animation: { duration: 900, easing: 'easeOutQuart', delay: 100 } } as any} />
        </div>
      )}
    </div>
  )
}
