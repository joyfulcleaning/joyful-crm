'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Copy, Pencil, SlidersHorizontal, ChevronLeft, ChevronRight, Link2, Check } from 'lucide-react'
import ServiceDetailModal from '@/components/modals/ServiceDetailModal'
import ServiceModal from '@/components/modals/ServiceModal'
import { useSyncPoll } from '@/lib/useSyncPoll'

const CAL_COLS = [
  { key: 'id',      label: 'ID' },
  { key: 'time',    label: 'Time' },
  { key: 'client',  label: 'Client' },
  { key: 'unit',    label: 'Unit' },
  { key: 'numericKey', label: 'Clave' },
  { key: 'roomSize',label: 'Room Size' },
  { key: 'address', label: 'Address' },
  { key: 'type',    label: 'Type' },
  { key: 'staff',   label: 'Staff' },
  { key: 'status',  label: 'Status' },
  { key: 'total',   label: 'Total' },
] as const
type CalColKey = typeof CAL_COLS[number]['key']

function initCalCols(): Set<CalColKey> {
  try {
    const saved = localStorage.getItem('cal-preview-cols')
    if (saved) return new Set(JSON.parse(saved) as CalColKey[])
  } catch {}
  return new Set(CAL_COLS.map(c => c.key))
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  completed: '#26BD97',
  cancelled: '#f87171',
}

const STATUS_PRIORITY: Record<string, number> = {
  estimate_visit: 0,
  pending:        1,
  in_progress:    2,
  cancelled:      3,
  completed:      4,
}

const TYPE_COLOR = { bg: 'rgba(79,142,247,0.12)', text: '#4f8ef7' }

const ESTIMATE_VISIT_COLOR = '#ec4899'

function initShowEstimateVisits(): boolean {
  try {
    const saved = localStorage.getItem('cal-show-estimate-visits')
    if (saved !== null) return saved === '1'
  } catch {}
  return true
}

function getDateStr(dateVal: string) {
  return dateVal?.split('T')[0]
}

function utcStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getCalWeeks(viewStart: Date, viewEnd: Date): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = []
  const cur = new Date(viewStart)
  while (cur < viewEnd) {
    const wStart = utcStr(cur)
    cur.setUTCDate(cur.getUTCDate() + 7)
    weeks.push({ start: wStart, end: utcStr(cur) })
  }
  return weeks
}

function weekLabel(wStart: string, wEnd: string): string {
  const s = new Date(wStart + 'T12:00:00Z')
  const e = new Date(wEnd + 'T12:00:00Z')
  e.setUTCDate(e.getUTCDate() - 1)
  const sm = s.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const em = e.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const sd = s.getUTCDate()
  const ed = e.getUTCDate()
  return sm === em ? `${sm} ${sd}–${ed}` : `${sm} ${sd}–${em} ${ed}`
}

function fmtAmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [estimateVisits, setEstimateVisits] = useState<any[]>([])
  const [selectedVisits, setSelectedVisits] = useState<any[]>([])
  const [showEstimateVisits, setShowEstimateVisits] = useState<boolean>(initShowEstimateVisits)
  const [viewStart, setViewStart] = useState<Date | null>(null)
  const [viewEnd, setViewEnd] = useState<Date | null>(null)
  const viewRangeRef = useRef<{ from: string; to: string } | null>(null)
  const [rowPositions, setRowPositions] = useState<{ top: number; height: number }[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedServices, setSelectedServices] = useState<any[]>([])
  const [duplicateService, setDuplicateService] = useState<any>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [editService, setEditService] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [newServiceOpen, setNewServiceOpen] = useState(false)
  const [newServiceDate, setNewServiceDate] = useState('')
  const servicesRef = useRef<any[]>([])
  const estimateVisitsRef = useRef<any[]>([])
  const calendarRef = useRef<any>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const loadServicesRef = useRef<(from?: string, to?: string) => void>(() => {})
  const [light, setLight] = useState(false)

  const [calVisibleCols, setCalVisibleCols] = useState<Set<CalColKey>>(initCalCols)
  const [calColPickerOpen, setCalColPickerOpen] = useState(false)
  const calColPickerRef = useRef<HTMLDivElement>(null)

  const { data: session } = useSession()
  const sessionUser = session?.user as any
  const [shareOpen, setShareOpen]     = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl]       = useState<string | null>(null)
  const [shareError, setShareError]   = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement>(null)

  function openShareMenu() {
    setShareOpen(v => !v)
    if (!shareUrl && !shareLoading) {
      setShareLoading(true)
      setShareError(false)
      fetch('/api/calendar/feed-link')
        .then(res => { if (!res.ok) throw new Error(); return res.json() })
        .then(d => setShareUrl(d.url))
        .catch(() => setShareError(true))
        .finally(() => setShareLoading(false))
    }
  }

  function copyShareUrl() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    })
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calColPickerRef.current && !calColPickerRef.current.contains(e.target as Node))
        setCalColPickerOpen(false)
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node))
        setShareOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleCalCol(key: CalColKey) {
    setCalVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem('cal-preview-cols', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const ccol = (key: CalColKey) => calVisibleCols.has(key)

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  // Measure each week row's position relative to the sidebar container
  const measureRows = useCallback(() => {
    setTimeout(() => {
      if (!sidebarRef.current || !calendarRef.current) return
      const calApi = calendarRef.current.getApi?.()
      if (!calApi) return
      const bodyEl = calApi.el?.querySelector('.fc-daygrid-body')
      if (!bodyEl) return
      const allRows = Array.from(bodyEl.querySelectorAll('tr')) as HTMLElement[]
      const weekRows = allRows.filter(r => r.querySelector('.fc-daygrid-day'))
      if (weekRows.length === 0) return
      const sbRect = sidebarRef.current.getBoundingClientRect()
      const positions = weekRows.map(row => {
        const rect = row.getBoundingClientRect()
        return { top: rect.top - sbRect.top, height: rect.height }
      })
      setRowPositions(positions)
    }, 300)
  }, [])

  useEffect(() => {
    window.addEventListener('resize', measureRows)
    return () => window.removeEventListener('resize', measureRows)
  }, [measureRows])

  // Re-measure whenever events change (row heights can shift)
  useEffect(() => { if (events.length > 0) measureRows() }, [events, measureRows])

  const injectBadges = useCallback(() => {
    setTimeout(() => {
      document.querySelectorAll('.fc-service-count').forEach(el => el.remove())
      document.querySelectorAll('.fc-day-add-btn').forEach(el => el.remove())

      document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateAttr = cell.getAttribute('data-date')
        if (!dateAttr) return
        const frame = cell.querySelector('.fc-daygrid-day-frame')
        if (!frame) return
        const top = cell.querySelector('.fc-daygrid-day-top')

        const count = servicesRef.current.filter(s => getDateStr(s.serviceDate) === dateAttr).length
        if (count > 0 && !frame.querySelector('.fc-service-count')) {
          const badge = document.createElement('div')
          badge.className = 'fc-service-count'
          badge.textContent = String(count)
          if (top) top.insertBefore(badge, top.firstChild)
          else frame.appendChild(badge)
        }

        const btn = document.createElement('button')
        btn.className = 'fc-day-add-btn'
        btn.textContent = '+'
        btn.title = 'New service'
        btn.onclick = (e) => {
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent('cal-new-service', { detail: { date: dateAttr } }))
        }
        if (top) top.appendChild(btn)
        else frame.appendChild(btn)
      })
    }, 80)
  }, [])

  const handleDatesSet = useCallback((info: any) => {
    setViewStart(info.start)
    setViewEnd(info.end)
    const from = utcStr(info.start)
    const to   = utcStr(info.end)
    viewRangeRef.current = { from, to }
    loadServicesRef.current(from, to)
    loadEstimateVisitsRef.current(from, to)
    injectBadges()
    measureRows()
  }, [injectBadges, measureRows])

  function loadServices(from?: string, to?: string) {
    const range = from && to ? { from, to } : viewRangeRef.current
    const qs = range ? `?from=${range.from}&to=${range.to}&cal=1` : '?cal=1'
    fetch(`/api/services${qs}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setServices(data)
        servicesRef.current = data
        const mapped = data.map((s: any) => ({
          id: s.id,
          title: `${s.serviceTime?.slice(0,5)} · ${s.client?.name?.split(' ').slice(0,2).join(' ') || 'Service'}`,
          start: `${getDateStr(s.serviceDate)}T${s.serviceTime}`,
          backgroundColor: `${STATUS_COLORS[s.status]}20` || '#6b728020',
          borderColor: STATUS_COLORS[s.status] || '#6b7280',
          textColor: STATUS_COLORS[s.status] || '#6b7280',
          order: STATUS_PRIORITY[s.status] ?? 4,
          extendedProps: s,
        }))
        setEvents(mapped)
        if (selectedDate) {
          const filtered = data
            .filter((s: any) => getDateStr(s.serviceDate) === selectedDate)
            .sort((a: any, b: any) => a.serviceTime.localeCompare(b.serviceTime))
          setSelectedServices(filtered)
        }
        injectBadges()
      })
      .catch(() => setEvents([]))
  }

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => setExpenses(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  function loadEstimateVisits(from?: string, to?: string) {
    const range = from && to ? { from, to } : viewRangeRef.current
    const qs = range ? `?from=${range.from}&to=${range.to}` : ''
    fetch(`/api/estimate-visits${qs}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setEstimateVisits(list)
        estimateVisitsRef.current = list
        if (selectedDate) {
          setSelectedVisits(list.filter((v: any) => getDateStr(v.visitDate) === selectedDate))
        }
      })
      .catch(() => setEstimateVisits([]))
  }

  useEffect(() => { loadExpenses() }, [])

  function toggleShowEstimateVisits() {
    setShowEstimateVisits(prev => {
      const next = !prev
      try { localStorage.setItem('cal-show-estimate-visits', next ? '1' : '0') } catch {}
      return next
    })
  }

  // Keep refs to the latest loaders so the polling interval below
  // (set up once) always runs with up-to-date closures (e.g. selectedDate).
  loadServicesRef.current = loadServices
  const loadExpensesRef = useRef(loadExpenses)
  loadExpensesRef.current = loadExpenses
  const loadEstimateVisitsRef = useRef(loadEstimateVisits)
  loadEstimateVisitsRef.current = loadEstimateVisits

  useSyncPoll(['services', 'expenses', 'estimateVisits'], () => {
    loadServicesRef.current()
    loadExpensesRef.current()
    loadEstimateVisitsRef.current()
  })

  useEffect(() => {
    function handler(e: Event) {
      const date = (e as CustomEvent<{ date: string }>).detail.date
      setNewServiceDate(date)
      setNewServiceOpen(true)
    }
    window.addEventListener('cal-new-service', handler)
    return () => window.removeEventListener('cal-new-service', handler)
  }, [])

  function selectDay(date: string) {
    setSelectedDate(date)
    const filtered = servicesRef.current
      .filter(s => getDateStr(s.serviceDate) === date)
      .sort((a, b) => a.serviceTime.localeCompare(b.serviceTime))
    setSelectedServices(filtered)
    setSelectedVisits(
      estimateVisitsRef.current
        .filter(v => getDateStr(v.visitDate) === date)
        .sort((a, b) => a.visitTime.localeCompare(b.visitTime))
    )
  }

  function handleDateClick(info: any) { selectDay(info.dateStr) }

  function shiftDay(delta: number) {
    if (!selectedDate) return
    const d = new Date(selectedDate + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    selectDay(d.toISOString().split('T')[0])
  }

  function handleDuplicate(s: any) {
    const duplicated = {
      ...s,
      id: null,
      serviceNumber: null,
      serviceDate: new Date().toISOString(),
      status: 'pending',
      _isDuplicate: true,
    }
    setDuplicateService(duplicated)
    setDuplicateOpen(true)
  }

  const _td = new Date()
  const todayStr = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}`
  const activeDate = selectedDate || todayStr
  const isToday = activeDate === todayStr
  const activeDateServices = services.filter(s => getDateStr(s.serviceDate) === activeDate)
  const activeDateRevenue = activeDateServices.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
  const activeDateLabel = isToday
    ? 'TODAY'
    : new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const visitEvents = showEstimateVisits ? estimateVisits.map(v => ({
    id: `visit-${v.id}`,
    title: `${v.visitTime?.slice(0,5)} · ${v.name}`,
    start: `${getDateStr(v.visitDate)}T${v.visitTime}`,
    backgroundColor: `${ESTIMATE_VISIT_COLOR}20`,
    borderColor: ESTIMATE_VISIT_COLOR,
    textColor: ESTIMATE_VISIT_COLOR,
    order: 0,
    extendedProps: { kind: 'estimateVisit', ...v },
  })) : []
  const calendarEvents = [...events, ...visitEvents]

  const calWeeks = viewStart && viewEnd ? getCalWeeks(viewStart, viewEnd) : []
  const weeklySummaries = calWeeks.map(({ start, end }) => {
    const wSvcs = services.filter(s => { const d = getDateStr(s.serviceDate); return d >= start && d < end })
    const revenue = wSvcs.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.total), 0)
    const expTotal = expenses.filter(e => { const d = getDateStr(e.expenseDate); return d >= start && d < end }).reduce((sum, e) => sum + Number(e.amount), 0)
    return { label: weekLabel(start, end), count: wSvcs.length, revenue, expenses: expTotal, net: revenue - expTotal }
  })

  useEffect(() => {
    document.querySelectorAll('.fc-day-selected').forEach(el => el.classList.remove('fc-day-selected'))
    if (activeDate) {
      const cell = document.querySelector(`.fc-daygrid-day[data-date="${activeDate}"]`)
      if (cell) cell.classList.add('fc-day-selected')
    }
  }, [activeDate, events])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Calendar</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Monthly operational overview</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showEstimateVisits}
              onChange={toggleShowEstimateVisits}
              className="w-3 h-3"
              style={{ accentColor: ESTIMATE_VISIT_COLOR }}
            />
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ESTIMATE_VISIT_COLOR }} />
            Estimate Visits
          </label>
          {sessionUser?.role === 'admin' && (
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={openShareMenu}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  shareOpen
                    ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[#4f8ef7]'
                }`}
              >
                <Link2 size={13} />
                Share Calendar
              </button>
              {shareOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-4 w-80">
                  <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Subscribe to this calendar</div>
                  {shareLoading ? (
                    <div className="text-xs text-[var(--muted)] py-2">Loading…</div>
                  ) : shareError || !shareUrl ? (
                    <div className="text-xs text-[#f87171] py-2">Couldn't load the link.</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-3">
                        <input
                          readOnly
                          value={shareUrl}
                          onFocus={e => e.currentTarget.select()}
                          className="flex-1 px-2 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--muted)] focus:outline-none"
                        />
                        <button
                          onClick={copyShareUrl}
                          title="Copy link"
                          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all flex-shrink-0"
                        >
                          {shareCopied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <a
                          href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-center px-3 py-2 bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text)] transition-colors"
                        >
                          Add to Google Calendar
                        </a>
                        <a
                          href={shareUrl.replace(/^https?:/, 'webcal:')}
                          className="block w-full text-center px-3 py-2 bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text)] transition-colors"
                        >
                          Add to Apple Calendar
                        </a>
                      </div>
                      <p className="text-[10px] text-[var(--muted)] mt-3">For Outlook or any other app, paste the link above as a "subscribe from URL" calendar.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => { setNewServiceDate(todayStr); setNewServiceOpen(true) }}
            className="px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Service
          </button>
        </div>
      </div>

      {/* Calendar + weekly sidebar */}
      <div className="flex gap-3">
        {/* Calendar */}
        <div className="flex-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 min-w-0 shadow-[var(--shadow-rest,none)]">
          <style>{`
            .fc { font-family: inherit; color: ${light ? '#1F1A3D' : '#e8eaf0'}; }
            .fc-theme-standard td, .fc-theme-standard th { border-color: ${light ? '#D3D7E0' : '#2a2f3d'} !important; }
            .fc-theme-standard .fc-scrollgrid { border-color: ${light ? '#D3D7E0' : '#2a2f3d'} !important; }
            .fc .fc-daygrid-day { background: transparent !important; }
            .fc .fc-daygrid-day:hover { background: ${light ? 'rgba(74,63,176,0.04)' : 'rgba(255,255,255,0.02)'} !important; cursor: pointer; }
            .fc .fc-daygrid-day-number { color: ${light ? '#5b5374' : '#6b7280'}; font-size: 12px; padding: 6px 8px; margin-left: auto !important; }
            .fc .fc-day-today { background: ${light ? 'rgba(74,63,176,0.07)' : 'rgba(56,217,169,0.05)'} !important; }
            .fc .fc-day-today .fc-daygrid-day-number { color: ${light ? '#4A3FB0' : '#38d9a9'}; font-weight: 700; }
            .fc .fc-col-header-cell { background: ${light ? '#E3E6ED' : '#0d0f14'} !important; border-color: ${light ? '#D3D7E0' : '#2a2f3d'} !important; }
            .fc .fc-col-header-cell-cushion { color: ${light ? '#5b5374' : '#6b7280'}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 4px; text-decoration: none !important; }
            .fc thead, .fc thead tr, .fc thead td, .fc thead th { background: ${light ? '#E3E6ED' : '#0d0f14'} !important; }
            .fc .fc-scrollgrid-section-header > td { background: ${light ? '#E3E6ED' : '#0d0f14'} !important; }
            .fc-sticky { position: relative !important; }
            .fc .fc-button { background: ${light ? '#FFFFFF' : '#1e2330'} !important; border: 1px solid ${light ? '#D3D7E0' : '#2a2f3d'} !important; color: ${light ? '#1F1A3D' : '#e8eaf0'} !important; font-size: 12px; padding: 5px 12px; border-radius: 8px !important; box-shadow: ${light ? '0 1px 2px rgba(74,63,176,0.06)' : 'none'} !important; }
            .fc .fc-button:hover { background: ${light ? '#EEF0F5' : '#252b3b'} !important; border-color: ${light ? '#BCC1CC' : '#343c52'} !important; }
            .fc .fc-button-primary:not(:disabled).fc-button-active { background: #4A3FB0 !important; border-color: #4A3FB0 !important; color: white !important; font-weight: 700 !important; }
            .fc .fc-toolbar-title { color: ${light ? '#1F1A3D' : '#e8eaf0'}; font-size: 16px; font-weight: 700; }
            .fc-event { border-radius: 4px !important; font-size: 10px !important; padding: 1px 5px; font-weight: 700; border-left-width: 3px !important; }
            .fc-event-time { display: none !important; }
            .fc .fc-daygrid-more-link { color: ${light ? '#6B7280' : '#6b7280'}; font-size: 10px; }
            .fc .fc-daygrid-body { background: transparent; }
            .fc .fc-scrollgrid-sync-table { background: transparent; }
            .fc .fc-daygrid-day-frame { position: relative !important; min-height: 80px !important; }
            .fc .fc-daygrid-day-top { display: flex !important; flex-direction: row !important; align-items: center !important; padding: 4px 4px 0 4px !important; }
            .fc .fc-timegrid { background: ${light ? '#FFFFFF' : '#0d0f14'} !important; }
            .fc .fc-timegrid-slot { border-color: ${light ? '#D3D7E0' : '#2a2f3d'} !important; }
            .fc .fc-timegrid-axis { color: ${light ? '#6B7280' : '#6b7280'} !important; font-size: 10px !important; }
            .fc-day-add-btn { display: none; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 4px; background: transparent; border: 1px solid transparent; color: ${light ? '#9ca3af' : '#6b7280'}; font-size: 13px; font-weight: 700; line-height: 1; padding: 0; cursor: pointer; margin-left: auto; transition: all 0.15s; flex-shrink: 0; }
            .fc-daygrid-day:hover .fc-day-add-btn { display: flex; }
            .fc-day-add-btn:hover { background: rgba(79,142,247,0.15) !important; border-color: #4f8ef7 !important; color: #4f8ef7 !important; }
            .fc-day-selected { background: ${light ? 'rgba(74,63,176,0.10)' : 'rgba(79,142,247,0.08)'} !important; box-shadow: inset 0 0 0 2px ${light ? '#4A3FB0' : '#4f8ef7'} !important; border-radius: 2px; }
            .fc-day-selected .fc-daygrid-day-number { color: ${light ? '#4A3FB0' : '#4f8ef7'} !important; font-weight: 700 !important; }
            .fc-service-count { width: 16px !important; height: 16px !important; border-radius: 50% !important; background: ${light ? 'rgba(74,63,176,0.10)' : 'rgba(79,142,247,0.15)'} !important; border: 1px solid #4A3FB0 !important; color: #4A3FB0 !important; font-size: 9px !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 4 !important; pointer-events: none !important; line-height: 1 !important; flex-shrink: 0 !important; }
          `}</style>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={calendarEvents}
            height="auto"
            fixedWeekCount={false}
            stickyHeaderDates={false}
            eventDisplay="block"
            dayMaxEvents={3}
            eventOrder="order,start"
            dateClick={handleDateClick}
            displayEventTime={false}
            datesSet={handleDatesSet}
          />
        </div>

        {/* Sidebar: daily summary + weekly cards aligned to calendar rows */}
        <div ref={sidebarRef} className="w-44 flex-shrink-0 relative">

          {/* Daily summary — normal flow at top */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 shadow-[var(--shadow-rest,none)]">
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1">{activeDateLabel}</div>
            <div className="text-2xl font-bold text-[#38d9a9]" style={{ fontFamily: 'var(--font-display)' }}>{fmtAmt(activeDateRevenue)}</div>
            <div className="text-[11px] text-[var(--muted)] mt-1">{activeDateServices.length} {activeDateServices.length === 1 ? 'service' : 'services'}</div>
          </div>

          {/* Weekly cards — absolutely positioned to match each calendar row */}
          {weeklySummaries.map((w, i) => {
            const pos = rowPositions[i]
            if (!pos || pos.height < 20) return null
            return (
              <div
                key={i}
                className="absolute left-0 right-0 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-rest,none)] overflow-hidden"
                style={{ top: pos.top + 3, height: pos.height - 6 }}
              >
                <div className="h-full flex flex-col justify-between p-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--muted)]">Services</span>
                    <span className="text-xs font-bold text-[var(--text)]">{w.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--muted)]">Revenue</span>
                    <span className="text-xs font-bold text-[#38d9a9]">{fmtAmt(w.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--muted)]">Expenses</span>
                    <span className="text-xs font-bold text-[#f87171]">{fmtAmt(w.expenses)}</span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-1 flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--muted)]">Net</span>
                    <span className={`text-xs font-bold ${w.net >= 0 ? 'text-[#38d9a9]' : 'text-[#f87171]'}`}>{fmtAmt(w.net)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail table */}
      {selectedDate && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 shadow-[var(--shadow-rest,none)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftDay(-1)} className="p-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[#4f8ef7] transition-all">
                <ChevronLeft size={14} />
              </button>
              <div className="text-sm font-semibold text-[var(--text)]">
                📋 Services for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button onClick={() => shiftDay(1)} className="p-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[#4f8ef7] transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="relative" ref={calColPickerRef}>
              <button
                onClick={() => setCalColPickerOpen(v => !v)}
                title="Show/hide columns"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                  calColPickerOpen
                    ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:text-[#4f8ef7] hover:border-[#4f8ef7]'
                }`}
              >
                <SlidersHorizontal size={11} />Columns
              </button>
              {calColPickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-3 min-w-[150px]">
                  <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Visible Columns</div>
                  {CAL_COLS.map(c => (
                    <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer group">
                      <input type="checkbox" checked={calVisibleCols.has(c.key)} onChange={() => toggleCalCol(c.key)} className="accent-[#4f8ef7] w-3 h-3" />
                      <span className="text-xs text-[var(--muted)] group-hover:text-[var(--text)] transition-colors">{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          {selectedServices.length === 0 ? (
            <p className="text-[var(--muted)] text-sm text-center py-6">No services scheduled for this day.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {ccol('id')       && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">ID</th>}
                  {ccol('time')     && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Time</th>}
                  {ccol('client')   && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Client</th>}
                  {ccol('unit')     && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Unit</th>}
                  {ccol('numericKey') && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Clave</th>}
                  {ccol('roomSize') && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Room Size</th>}
                  {ccol('address')  && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Address</th>}
                  {ccol('type')     && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Type</th>}
                  {ccol('staff')    && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Staff</th>}
                  {ccol('status')   && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Status</th>}
                  {ccol('total')    && <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Total</th>}
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {selectedServices.map((s: any) => (
                  <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--surface2)]">
                    {ccol('id')       && <td className="py-2 text-xs text-[#4f8ef7]" style={{ fontFamily: 'var(--font-mono)' }}>#{s.serviceNumber}</td>}
                    {ccol('time')     && <td className="py-2 text-[var(--muted2)]">{s.serviceTime}</td>}
                    {ccol('client')   && <td className="py-2 text-[var(--text)]">{s.client?.name}</td>}
                    {ccol('unit')     && <td className="py-2 text-[var(--muted)] text-xs">{s.unit || '—'}</td>}
                    {ccol('numericKey') && <td className="py-2 text-[var(--muted)] text-xs">{s.numericKey ? `Clave ${s.numericKey}` : '—'}</td>}
                    {ccol('roomSize') && <td className="py-2 text-[var(--muted)] text-xs">{s.roomSize || '—'}</td>}
                    {ccol('address')  && <td className="py-2 text-[var(--muted)] text-xs max-w-32 truncate">{s.address || '—'}</td>}
                    {ccol('type')     && <td className="py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: TYPE_COLOR.bg, color: TYPE_COLOR.text }}>{s.type}</span>
                    </td>}
                    {ccol('staff')    && <td className="py-2 text-[#9ca3af] text-xs">
                      {s.staff?.length > 0 ? s.staff.map((st: any) => st.user?.name?.split(' ')[0]).join(', ') : '—'}
                    </td>}
                    {ccol('status')   && <td className="py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${STATUS_COLORS[s.status]}20`, color: STATUS_COLORS[s.status] }}>
                        {s.status?.replace('_', ' ')}
                      </span>
                    </td>}
                    {ccol('total')    && <td className="py-2 font-bold text-[#38d9a9]" style={{ fontFamily: 'var(--font-mono)' }}>${s.total}</td>}
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditService(s); setEditOpen(true) }} title="Edit"
                          className="p-1 rounded text-[#6b7280] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.1)] transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDuplicate(s)} title="Duplicate"
                          className="p-1 rounded text-[#6b7280] hover:text-[#38d9a9] hover:bg-[rgba(56,217,169,0.1)] transition-all">
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedDate && showEstimateVisits && selectedVisits.length > 0 && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 shadow-[var(--shadow-rest,none)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ESTIMATE_VISIT_COLOR }} />
            <div className="text-sm font-semibold text-[var(--text)]">Estimate Visits</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Time</th>
                <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Name</th>
                <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Phone</th>
                <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Address</th>
                <th className="text-left text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pb-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {selectedVisits.map(v => (
                <tr key={v.id} className="border-b border-[var(--border)] hover:bg-[var(--surface2)]">
                  <td className="py-2 text-[var(--muted2)]">{v.visitTime}</td>
                  <td className="py-2 text-[var(--text)]">{v.name}</td>
                  <td className="py-2 text-[var(--muted)] text-xs">{v.phone || '—'}</td>
                  <td className="py-2 text-[var(--muted)] text-xs max-w-32 truncate">{v.address || '—'}</td>
                  <td className="py-2 text-[var(--muted)] text-xs max-w-40 truncate">{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceDetailModal
        service={editService}
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditService(null) }}
        onSuccess={() => { loadServices(); setEditOpen(false); setEditService(null) }}
      />
      <ServiceDetailModal
        service={duplicateService}
        open={duplicateOpen}
        onClose={() => { setDuplicateOpen(false); setDuplicateService(null) }}
        onSuccess={() => { loadServices(); setDuplicateOpen(false); setDuplicateService(null) }}
      />
      <ServiceModal
        open={newServiceOpen}
        initialDate={newServiceDate}
        onClose={() => setNewServiceOpen(false)}
        onSuccess={() => { loadServices(); setNewServiceOpen(false) }}
      />
    </div>
  )
}
