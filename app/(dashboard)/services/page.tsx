'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Search, Eye, Pencil, Copy, Trash2, CalendarDays, X, Download, SlidersHorizontal } from 'lucide-react'
import * as XLSX from 'xlsx'
import ServiceModal from '@/components/modals/ServiceModal'
import ServiceDetailModal from '@/components/modals/ServiceDetailModal'
import ConfirmModal from '@/components/modals/ConfirmModal'
import ClientModal from '@/components/modals/ClientModal'
import { useSyncPoll } from '@/lib/useSyncPoll'
import CountUp from '@/components/ui/CountUp'
import ErrorBanner from '@/components/ErrorBanner'
import { localDateStr } from '@/lib/local-date'
import { useI18n } from '@/lib/i18n'

function fmt12h(t?: string | null) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const COLS = [
  { key: 'id' },
  { key: 'date' },
  { key: 'time' },
  { key: 'client' },
  { key: 'address' },
  { key: 'unit' },
  { key: 'roomSize' },
  { key: 'type' },
  { key: 'basePrice' },
  { key: 'addFee' },
  { key: 'total' },
  { key: 'status' },
  { key: 'staff' },
  { key: 'payment' },
  { key: 'invoice' },
] as const
type ColKey = typeof COLS[number]['key']

const DEFAULT_VISIBLE_COLS = new Set(COLS.map(c => c.key)) as Set<ColKey>

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  reschedule: '#a78bfa',
  completed: '#26BD97',
  cancelled: '#f87171',
}

const TYPE_COLOR = '#4f8ef7'

export default function ServicesPage() {
  const { t } = useI18n()
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('all')
  const [clientFilter, setClientFilter] = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'uninvoiced' | 'invoiced'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)

  const [sortKey, setSortKey]   = useState('serviceDate')
  const [sortDir, setSortDir]   = useState<'asc'|'desc'>('asc')

  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  // ── Column picker ──
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_VISIBLE_COLS)
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('services-visible-cols')
      if (saved) setVisibleCols(new Set(JSON.parse(saved) as ColKey[]))
    } catch {}
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setColPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem('services-visible-cols', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const col = (key: ColKey) => visibleCols.has(key)

  // ── Confirm modal ──
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Bulk selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Row being reviewed (click a row to keep it highlighted across all its columns) ──
  const [reviewRowId, setReviewRowId] = useState<string | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exportToExcel() {
    const rows = filtered.map(s => ({
      [t.servicesPage.columnLabels.id]:             `#${s.serviceNumber}`,
      [t.servicesPage.columnLabels.date]:           s.serviceDate ? (([y,m,d]) => `${m}-${d}-${y}`)(s.serviceDate.split('T')[0].split('-')) : '',
      [t.servicesPage.columnLabels.time]:           fmt12h(s.serviceTime),
      [t.servicesPage.columnLabels.client]:         s.client?.name || '',
      [t.servicesPage.columnLabels.address]:        s.address || '',
      [t.servicesPage.columnLabels.unit]:           s.unit || '',
      [t.servicesPage.columnLabels.roomSize]:       s.roomSize || '',
      [t.servicesPage.columnLabels.type]:           s.type || '',
      [t.servicesPage.excelHeaders.basePrice]:      Number(s.basePrice) || 0,
      [t.servicesPage.excelHeaders.additionalFee]:  Number(s.additionalFee) || 0,
      [t.servicesPage.columnLabels.total]:          Number(s.total) || 0,
      [t.servicesPage.columnLabels.status]:         s.status || '',
      [t.servicesPage.columnLabels.staff]:          s.staff?.map((st: any) => st.user?.name).join(', ') || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Services')

    const datePart = dateFrom && dateTo
      ? `${dateFrom}_to_${dateTo}`
      : dateFrom ? `from_${dateFrom}` : dateTo ? `to_${dateTo}` : 'all'
    XLSX.writeFile(wb, `services_${datePart}.xlsx`)
  }

  function loadServices() {
    fetch('/api/services')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || t.servicesPage.loadError)
        return data
      })
      .then(data => { setServices(data); setLoadError(null); setLoading(false) })
      .catch((err) => { setLoadError(err.message || t.servicesPage.loadError); setLoading(false) })
  }

  useEffect(() => { loadServices() }, [])

  useSyncPoll(['services'], loadServices)

  function handleDuplicate(s: any) {
    const duplicated = {
      ...s,
      id: null,
      serviceNumber: null,
      serviceDate: new Date().toISOString(),
      status: 'pending',
      _isDuplicate: true,
    }
    setSelectedService(duplicated)
    setDetailOpen(true)
  }

  function requestDelete(s: any) {
    setConfirmTarget(s)
    setConfirmOpen(true)
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/services/${confirmTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setConfirmOpen(false)
        alert(data.error || t.servicesPage.failedToDeleteService)
        return
      }
      // Elimina del state local inmediatamente — sin reload
      setServices(prev => prev.filter(s => s.id !== confirmTarget.id))
      setConfirmOpen(false)
      setConfirmTarget(null)
    } catch {
      alert(t.servicesPage.failedToDeleteService)
    } finally {
      setDeleting(false)
    }
  }

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>()
    services.forEach(s => { if (s.client?.id) map.set(s.client.id, s.client.name) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [services])

  const filtered = useMemo(() => {
    const list = services.filter(s => {
      const matchSearch = !search ||
        String(s.serviceNumber).includes(search) ||
        s.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.type?.toLowerCase().includes(search.toLowerCase()) ||
        s.address?.toLowerCase().includes(search.toLowerCase()) ||
        s.invoiceItems?.[0]?.invoice?.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
      const matchStatus  = filter === 'all' || s.status === filter
      const matchClient  = !clientFilter || s.client?.id === clientFilter
      const sDate = s.serviceDate ? s.serviceDate.split('T')[0] : ''
      const matchFrom    = !dateFrom || sDate >= dateFrom
      const matchTo      = !dateTo   || sDate <= dateTo
      const matchInvoice = invoiceFilter === 'all'
        || (invoiceFilter === 'uninvoiced' ? !s.invoicedAt : !!s.invoicedAt)
      return matchSearch && matchStatus && matchClient && matchFrom && matchTo && matchInvoice
    })
    return list.sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'serviceNumber') { av = a.serviceNumber; bv = b.serviceNumber }
      else if (sortKey === 'client')   { av = a.client?.name ?? ''; bv = b.client?.name ?? '' }
      else if (sortKey === 'time')     { av = a.serviceTime ?? ''; bv = b.serviceTime ?? '' }
      else if (sortKey === 'address')  { av = a.address ?? ''; bv = b.address ?? '' }
      else if (sortKey === 'roomSize') { av = a.roomSize ?? ''; bv = b.roomSize ?? '' }
      else if (sortKey === 'type')     { av = a.type ?? ''; bv = b.type ?? '' }
      else if (sortKey === 'basePrice'){ av = Number(a.basePrice || 0); bv = Number(b.basePrice || 0) }
      else if (sortKey === 'addFee')   { av = Number(a.additionalFee || 0); bv = Number(b.additionalFee || 0) }
      else if (sortKey === 'total')    { av = Number(a.total || 0); bv = Number(b.total || 0) }
      else if (sortKey === 'status')   { av = a.status ?? ''; bv = b.status ?? '' }
      else if (sortKey === 'payment')  { av = a.paymentMethod ?? ''; bv = b.paymentMethod ?? '' }
      else                             { av = a.serviceDate ?? ''; bv = b.serviceDate ?? '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [services, search, filter, clientFilter, dateFrom, dateTo, sortKey, sortDir, invoiceFilter])

  const stats = useMemo(() => {
    const counts:  Record<string, number> = { pending: 0, in_progress: 0, reschedule: 0, completed: 0, cancelled: 0 }
    const amounts: Record<string, number> = { pending: 0, in_progress: 0, reschedule: 0, completed: 0, cancelled: 0 }
    let totalAmount = 0
    filtered.forEach(s => {
      const t = Number(s.total) || 0
      totalAmount += t
      if (s.status in counts) { counts[s.status]++; amounts[s.status] += t }
    })
    const completedUninvoiced = filtered.filter(s => s.status === 'completed' && !s.invoicedAt).length
    return { total: filtered.length, totalAmount, counts, amounts, completedRevenue: amounts.completed, completedUninvoiced }
  }, [filtered])

  useEffect(() => {
    if (loading || filtered.length === 0 || sortKey !== 'serviceDate') return
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const target = sortDir === 'asc'
      ? filtered.find(s => (s.serviceDate ? s.serviceDate.slice(0, 10) : '') >= todayStr)
      : filtered.find(s => (s.serviceDate ? s.serviceDate.slice(0, 10) : '') <= todayStr)
    const targetId = target?.id ?? filtered[filtered.length - 1]?.id
    const row = targetId ? rowRefs.current.get(targetId) : null
    row?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [loading, filtered, sortKey, sortDir])

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id))
  const someFilteredSelected = filtered.some(s => selectedIds.has(s.id))
  const selectedCount = filtered.filter(s => selectedIds.has(s.id)).length

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(s => next.delete(s.id)); return next })
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(s => next.add(s.id)); return next })
    }
  }

  async function handleBulkDelete() {
    const ids = filtered.filter(s => selectedIds.has(s.id)).map(s => s.id)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) { setBulkConfirmOpen(false); alert(data.error || t.servicesPage.failedToDeleteServices); return }
      setServices(prev => prev.filter(s => !ids.includes(s.id)))
      setSelectedIds(new Set())
      setBulkConfirmOpen(false)
    } catch {
      alert(t.servicesPage.failedToDeleteServices)
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {loadError && <ErrorBanner message={loadError} onRetry={loadServices} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">{t.nav.services}</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">{t.servicesPage.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={filtered.length === 0}
            title={t.servicesPage.exportExcelTitle}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] disabled:opacity-40 transition-all text-xs font-semibold"
          >
            <Download size={13} />{t.servicesPage.excel}
          </button>

          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setColPickerOpen(v => !v)}
              title={t.servicesPage.showHideColumnsTitle}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                colPickerOpen
                  ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                  : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7]'
              }`}
            >
              <SlidersHorizontal size={13} />{t.servicesPage.columnsButton}
            </button>
            {colPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e2330] border border-[#2a2f3d] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-3 min-w-[160px]">
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">{t.servicesPage.visibleColumns}</div>
                {COLS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="accent-[#4f8ef7] w-3 h-3"
                    />
                    <span className="text-xs text-[#9ca3af] group-hover:text-[#e8eaf0] transition-colors">{t.servicesPage.columnLabels[c.key]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#f87171] text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] text-xs font-semibold transition-all"
            >
              <Trash2 size={13} />{t.servicesPage.deleteCount(selectedCount)}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} />
            {t.servicesPage.newService}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-6 gap-2">
          {[
            { statusKey: 'all',         label: t.servicesPage.totalServices, value: stats.total,               color: '#6b7280', bg: 'rgba(107,114,128,0.1)'  },
            { statusKey: 'pending',     label: t.status.pending,             value: stats.counts.pending,      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'   },
            { statusKey: 'in_progress', label: t.status.in_progress,         value: stats.counts.in_progress,  color: '#4f8ef7', bg: 'rgba(79,142,247,0.1)'   },
            { statusKey: 'reschedule',  label: t.status.reschedule,          value: stats.counts.reschedule,   color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
            { statusKey: 'completed',   label: t.status.completed,           value: stats.counts.completed,    color: '#26BD97', bg: 'rgba(38,189,151,0.1)'   },
            { statusKey: 'cancelled',   label: t.status.cancelled,           value: stats.counts.cancelled,    color: '#f87171', bg: 'rgba(248,113,113,0.1)'  },
          ].map(card => {
            const isActive = filter === card.statusKey
            return (
              <div key={card.statusKey}
                className={`bg-[#161922] rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${isActive ? 'border-2' : 'border border-[#2a2f3d] hover:border-opacity-60'}`}
                style={{ borderColor: isActive ? card.color : `${card.color}40`, boxShadow: isActive ? `0 0 0 3px ${card.color}26` : undefined, background: isActive ? card.bg : '#161922' }}
                onClick={() => setFilter(card.statusKey)}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: card.bg, color: card.color }}>
                  <CountUp value={card.value} />
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${isActive ? '' : 'text-[#6b7280]'}`}
                  style={isActive ? { color: card.color } : undefined}>
                  {card.label}
                </div>
              </div>
            )
          })}
          {/* Completed not invoiced */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
              <CountUp value={stats.completedUninvoiced} />
            </div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider leading-tight">{t.servicesPage.completedNotInvoiced}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input
              type="text"
              placeholder={t.servicesPage.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-7 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] w-48"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                <X size={12} />
              </button>
            )}
          </div>
          {/* Client dropdown */}
          <div className="relative">
            <select
              value={clientFilter}
              onChange={e => {
                if (e.target.value === '__add_client__') { setClientModalOpen(true); return }
                setClientFilter(e.target.value)
              }}
              className="pl-3 pr-7 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors appearance-none w-48"
            >
              <option value="">{t.servicesPage.allClients}</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
              <option value="__add_client__">{t.servicesPage.newClientOption}</option>
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] text-[10px]">▾</span>
          </div>

          {/* Date from */}
          <div className="flex items-center gap-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2.5 py-1.5">
            <CalendarDays size={11} className="text-[#6b7280] flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-[#e8eaf0] focus:outline-none w-28"
            />
          </div>
          <span className="text-[#6b7280] text-xs">—</span>
          {/* Date to */}
          <div className="flex items-center gap-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2.5 py-1.5">
            <CalendarDays size={11} className="text-[#6b7280] flex-shrink-0" />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-[#e8eaf0] focus:outline-none w-28"
            />
          </div>

          {/* Invoice filter toggle */}
          <div className="flex items-center bg-[#1e2330] border border-[#2a2f3d] rounded-lg overflow-hidden">
            {([
              { key: 'all',        label: t.servicesPage.invoiceFilter.all },
              { key: 'uninvoiced', label: t.servicesPage.invoiceFilter.noInvoice },
              { key: 'invoiced',   label: t.servicesPage.invoiceFilter.invoiced },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setInvoiceFilter(opt.key)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  invoiceFilter === opt.key
                    ? 'bg-[#4f8ef7] text-white'
                    : 'text-[#6b7280] hover:text-[#e8eaf0]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {(clientFilter || dateFrom || dateTo || invoiceFilter !== 'all') && (
            <button
              onClick={() => { setClientFilter(''); setDateFrom(''); setDateTo(''); setInvoiceFilter('all') }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-[#6b7280] hover:text-[#f87171] border border-[#2a2f3d] hover:border-[#f87171] transition-all"
            >
              <X size={11} />{t.servicesPage.clear}
            </button>
          )}
        </div>

      {/* Table */}
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
        <table className="w-full min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e2330] border-b border-[#2a2f3d]">
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
                  onChange={toggleSelectAll}
                  className="accent-[#4f8ef7] w-3 h-3 cursor-pointer"
                />
              </th>
              {([
                { colKey: 'id',        sk: 'serviceNumber' },
                { colKey: 'date',      sk: 'serviceDate'   },
                { colKey: 'time',      sk: 'time'          },
                { colKey: 'client',    sk: 'client'        },
                { colKey: 'address',   sk: 'address'       },
                { colKey: 'unit',      sk: null            },
                { colKey: 'roomSize',  sk: 'roomSize'      },
                { colKey: 'type',      sk: 'type'          },
                { colKey: 'basePrice', sk: 'basePrice'     },
                { colKey: 'addFee',    sk: 'addFee'        },
                { colKey: 'total',     sk: 'total'         },
                { colKey: 'status',    sk: 'status'        },
                { colKey: 'staff',     sk: null            },
                { colKey: 'payment',   sk: 'payment'       },
                { colKey: 'invoice',   sk: null            },
              ] as const).map(({ colKey, sk }) => col(colKey as any) && (
                <th
                  key={colKey}
                  onClick={sk ? () => {
                    if (sortKey === sk) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortKey(sk); setSortDir('asc') }
                  } : undefined}
                  className={`text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 whitespace-nowrap select-none ${
                    sk ? 'cursor-pointer hover:text-[#e8eaf0] transition-colors' : ''
                  } ${sortKey === sk ? 'text-[#4f8ef7]' : 'text-[#6b7280]'}`}
                >
                  {t.servicesPage.columnLabels[colKey]}{sk && sortKey === sk ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody ref={tableBodyRef}>
            {loading ? (
              <tr>
                <td colSpan={visibleCols.size + 2} className="text-center py-10 text-[#6b7280] text-xs">{t.servicesPage.loading}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.size + 2} className="text-center py-10 text-[#6b7280] text-xs">
                  {t.servicesPage.noServicesFound}
                </td>
              </tr>
            ) : (
              filtered.map((s: any) => {
                const color = STATUS_COLORS[s.status] || '#6b7280'
                return (
                  <tr
                    key={s.id}
                    ref={el => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id) }}
                    onClick={() => setReviewRowId(prev => prev === s.id ? null : s.id)}
                    style={{
                      backgroundColor: reviewRowId === s.id ? 'rgba(74,63,176,0.16)' : undefined,
                      borderLeft: reviewRowId === s.id ? '3px solid #4A3FB0' : '3px solid transparent',
                    }}
                    className="border-b border-[#2a2f3d]/50 whitespace-nowrap cursor-pointer transition-colors hover:bg-[var(--surface3)]"
                  >
                    <td className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="accent-[#4f8ef7] w-3 h-3 cursor-pointer"
                      />
                    </td>
                    {col('id') && <td className="px-3 py-2.5 text-xs text-[#4f8ef7] font-mono font-medium">
                      #{s.serviceNumber}
                      {s.invoicedAt && (
                        <span className="ml-1 text-[9px] text-[#f59e0b] bg-[#f59e0b15] px-1 py-0.5 rounded">{t.servicesPage.invoicedBadge}</span>
                      )}
                    </td>}
                    {col('date') && <td className="px-3 py-2.5 text-xs text-[#9ca3af]">
                      {s.serviceDate ? (([y,m,d]) => `${m}-${d}-${y}`)(s.serviceDate.split('T')[0].split('-')) : '—'}
                    </td>}
                    {col('time')      && <td className="px-3 py-2.5 text-xs text-[#9ca3af]">{fmt12h(s.serviceTime)}</td>}
                    {col('client')    && <td className="px-3 py-2.5 text-xs text-[#e8eaf0] font-medium">{s.client?.name}</td>}
                    {col('address')   && <td className="px-3 py-2.5 text-xs text-[#6b7280]">{s.address || '—'}</td>}
                    {col('unit')      && <td className="px-3 py-2.5 text-xs text-[#6b7280]">{s.unit || '—'}</td>}
                    {col('roomSize')  && <td className="px-3 py-2.5 text-xs text-[#6b7280]">{s.roomSize || '—'}</td>}
                    {col('type') && <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${TYPE_COLOR}15`, color: TYPE_COLOR }}>
                        {s.type}
                      </span>
                    </td>}
                    {col('basePrice') && <td className="px-3 py-2.5 text-xs text-[#9ca3af]">${s.basePrice}</td>}
                    {col('addFee') && <td className="px-3 py-2.5 text-xs text-[#f59e0b]">
                      {s.additionalFee ? `$${s.additionalFee}` : '—'}
                    </td>}
                    {col('total')     && <td className="px-3 py-2.5 text-xs font-bold text-[#38d9a9] font-mono">${s.total}</td>}
                    {col('status') && <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ backgroundColor: `${color}20`, color }}>
                        {t.status[s.status] || s.status}
                      </span>
                    </td>}
                    {col('staff') && <td className="px-3 py-2.5 text-xs text-[#9ca3af]">
                      {s.staff?.length > 0
                        ? s.staff.map((st: any) => st.user?.name?.split(' ')[0]).join(', ')
                        : '—'}
                    </td>}
                    {col('payment') && <td className="px-3 py-2.5 text-xs text-[#6b7280]">{s.paymentMethod || '—'}</td>}
                    {col('invoice') && <td className="px-3 py-2.5 text-xs font-mono">
                      {s.invoiceItems?.[0]?.invoice?.invoiceNumber
                        ? <span className="text-[#4f8ef7] font-semibold">{s.invoiceItems[0].invoice.invoiceNumber}</span>
                        : <span className="text-[#4b5563]">—</span>}
                    </td>}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedService(s); setDetailOpen(true) }}
                          title={t.servicesPage.actions.view}
                          className="p-1 rounded text-[#6b7280] hover:text-[#4f8ef7] hover:bg-[rgba(79,142,247,0.1)] transition-all">
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => { setSelectedService(s); setDetailOpen(true) }}
                          title={t.servicesPage.actions.edit}
                          className="p-1 rounded text-[#6b7280] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.1)] transition-all">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(s)}
                          title={t.servicesPage.actions.duplicate}
                          className="p-1 rounded text-[#6b7280] hover:text-[#38d9a9] hover:bg-[rgba(56,217,169,0.1)] transition-all">
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => requestDelete(s)}
                          title={t.servicesPage.actions.delete}
                          className="p-1 rounded text-[#6b7280] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Count + filtered total */}
      {!loading && (
        <div className="flex items-center gap-4 text-xs text-[#6b7280]">
          <span>{t.servicesPage.showingLabel} <span className="font-semibold text-[#e8eaf0]">{filtered.length}</span> {t.servicesPage.ofServices(services.length)}</span>
          {filtered.length > 0 && (
            <>
              <span className="text-[#2a2f3d]">|</span>
              <span>
                {t.servicesPage.total}{' '}
                <span className="font-bold text-[#38d9a9] font-mono">
                  ${filtered.reduce((s, r) => s + (Number(r.total) || 0), 0)
                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <ServiceModal
        open={modalOpen}
        initialDate={localDateStr()}
        onClose={() => setModalOpen(false)}
        onSuccess={loadServices}
      />
      <ServiceDetailModal
        service={selectedService}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedService(null) }}
        onSuccess={loadServices}
      />
      <ConfirmModal
        open={confirmOpen}
        title={t.servicesPage.deleteServiceTitle(confirmTarget?.serviceNumber)}
        message={
          confirmTarget?.invoicedAt
            ? t.servicesPage.deleteInvoicedMessage
            : t.servicesPage.deleteServiceMessage(confirmTarget?.serviceNumber)
        }
        confirmLabel={deleting ? t.servicesPage.deleting : t.servicesPage.actions.delete}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null) }}
      />
      <ConfirmModal
        open={bulkConfirmOpen}
        title={t.servicesPage.deleteServicesTitle(selectedCount)}
        message={t.servicesPage.deleteServicesMessage(selectedCount)}
        confirmLabel={bulkDeleting ? t.servicesPage.deleting : t.servicesPage.deleteCount(selectedCount)}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
      <ClientModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSuccess={() => { setClientModalOpen(false); loadServices() }}
      />
    </div>
  )
}
