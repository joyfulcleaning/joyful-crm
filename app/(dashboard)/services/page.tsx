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

function fmt12h(t?: string | null) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const COLS = [
  { key: 'id',        label: 'ID' },
  { key: 'date',      label: 'Date' },
  { key: 'time',      label: 'Time' },
  { key: 'client',    label: 'Client' },
  { key: 'address',   label: 'Address' },
  { key: 'unit',      label: 'Unit' },
  { key: 'roomSize',  label: 'Room Size' },
  { key: 'type',      label: 'Type' },
  { key: 'basePrice', label: 'Price' },
  { key: 'addFee',    label: 'Add. Fee' },
  { key: 'total',     label: 'Total' },
  { key: 'status',    label: 'Status' },
  { key: 'staff',     label: 'Staff' },
  { key: 'payment',   label: 'Payment' },
  { key: 'invoice',   label: 'Invoice #' },
] as const
type ColKey = typeof COLS[number]['key']

const DEFAULT_VISIBLE_COLS = new Set(COLS.map(c => c.key)) as Set<ColKey>

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  completed: '#26BD97',
  cancelled: '#f87171',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const TYPE_COLOR = '#4f8ef7'

export default function ServicesPage() {
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

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exportToExcel() {
    const rows = filtered.map(s => ({
      'ID':             `#${s.serviceNumber}`,
      'Date':           s.serviceDate ? (([y,m,d]) => `${m}-${d}-${y}`)(s.serviceDate.split('T')[0].split('-')) : '',
      'Time':           fmt12h(s.serviceTime),
      'Client':         s.client?.name || '',
      'Address':        s.address || '',
      'Unit':           s.unit || '',
      'Room Size':      s.roomSize || '',
      'Type':           s.type || '',
      'Base Price':     Number(s.basePrice) || 0,
      'Additional Fee': Number(s.additionalFee) || 0,
      'Total':          Number(s.total) || 0,
      'Status':         s.status || '',
      'Staff':          s.staff?.map((st: any) => st.user?.name).join(', ') || '',
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
        if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar los servicios.')
        return data
      })
      .then(data => { setServices(data); setLoadError(null); setLoading(false) })
      .catch((err) => { setLoadError(err.message || 'No se pudieron cargar los servicios.'); setLoading(false) })
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
        alert(data.error || 'Failed to delete service')
        return
      }
      // Elimina del state local inmediatamente — sin reload
      setServices(prev => prev.filter(s => s.id !== confirmTarget.id))
      setConfirmOpen(false)
      setConfirmTarget(null)
    } catch {
      alert('Failed to delete service')
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
    const counts:  Record<string, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }
    const amounts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }
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
      if (!res.ok) { setBulkConfirmOpen(false); alert(data.error || 'Failed to delete'); return }
      setServices(prev => prev.filter(s => !ids.includes(s.id)))
      setSelectedIds(new Set())
      setBulkConfirmOpen(false)
    } catch {
      alert('Failed to delete services')
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
          <h1 className="text-lg font-bold text-[#e8eaf0]">Services</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Complete service management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={filtered.length === 0}
            title="Export to Excel"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] disabled:opacity-40 transition-all text-xs font-semibold"
          >
            <Download size={13} />Excel
          </button>

          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setColPickerOpen(v => !v)}
              title="Show/hide columns"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                colPickerOpen
                  ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                  : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7]'
              }`}
            >
              <SlidersHorizontal size={13} />Columns
            </button>
            {colPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e2330] border border-[#2a2f3d] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-3 min-w-[160px]">
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">Visible Columns</div>
                {COLS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="accent-[#4f8ef7] w-3 h-3"
                    />
                    <span className="text-xs text-[#9ca3af] group-hover:text-[#e8eaf0] transition-colors">{c.label}</span>
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
              <Trash2 size={13} />Delete {selectedCount}
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} />
            New Service
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Total Services', value: stats.total,               color: '#6b7280', bg: 'rgba(107,114,128,0.1)'  },
            { label: 'Pending',     value: stats.counts.pending,      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'   },
            { label: 'In Progress', value: stats.counts.in_progress,  color: '#4f8ef7', bg: 'rgba(79,142,247,0.1)'   },
            { label: 'Completed',   value: stats.counts.completed,    color: '#26BD97', bg: 'rgba(38,189,151,0.1)'   },
            { label: 'Cancelled',   value: stats.counts.cancelled,    color: '#f87171', bg: 'rgba(248,113,113,0.1)'  },
          ].map(card => (
            <div key={card.label}
              className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-opacity-60 transition-all"
              style={{ borderColor: `${card.color}40` }}
              onClick={() => setFilter(card.label === 'Total Services' ? 'all' : Object.keys(STATUS_LABELS).find(k => STATUS_LABELS[k] === card.label) || 'all')}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: card.bg, color: card.color }}>
                <CountUp value={card.value} />
              </div>
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider leading-tight">{card.label}</div>
            </div>
          ))}
          {/* Completed not invoiced */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
              <CountUp value={stats.completedUninvoiced} />
            </div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider leading-tight">Completed not Invoiced</div>
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
              placeholder="Search services..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] w-48"
            />
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
              <option value="">All clients</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
              <option value="__add_client__">+ New Client…</option>
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
              { key: 'all',        label: 'All' },
              { key: 'uninvoiced', label: 'No Invoice' },
              { key: 'invoiced',   label: 'Invoiced' },
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
              <X size={11} />Clear
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
                { colKey: 'id',        label: 'ID',        sk: 'serviceNumber' },
                { colKey: 'date',      label: 'Date',      sk: 'serviceDate'   },
                { colKey: 'time',      label: 'Time',      sk: 'time'          },
                { colKey: 'client',    label: 'Client',    sk: 'client'        },
                { colKey: 'address',   label: 'Address',   sk: 'address'       },
                { colKey: 'unit',      label: 'Unit',      sk: null            },
                { colKey: 'roomSize',  label: 'Room Size', sk: 'roomSize'      },
                { colKey: 'type',      label: 'Type',      sk: 'type'          },
                { colKey: 'basePrice', label: 'Price',     sk: 'basePrice'     },
                { colKey: 'addFee',    label: 'Add. Fee',  sk: 'addFee'        },
                { colKey: 'total',     label: 'Total',     sk: 'total'         },
                { colKey: 'status',    label: 'Status',    sk: 'status'        },
                { colKey: 'staff',     label: 'Staff',     sk: null            },
                { colKey: 'payment',   label: 'Payment',   sk: 'payment'       },
                { colKey: 'invoice',   label: 'Invoice #', sk: null            },
              ] as const).map(({ colKey, label, sk }) => col(colKey as any) && (
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
                  {label}{sk && sortKey === sk ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody ref={tableBodyRef}>
            {loading ? (
              <tr>
                <td colSpan={visibleCols.size + 2} className="text-center py-10 text-[#6b7280] text-xs">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.size + 2} className="text-center py-10 text-[#6b7280] text-xs">
                  No services found. Create your first service to get started.
                </td>
              </tr>
            ) : (
              filtered.map((s: any) => {
                const color = STATUS_COLORS[s.status] || '#6b7280'
                return (
                  <tr
                    key={s.id}
                    ref={el => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id) }}
                    className="border-b border-[#2a2f3d]/50 hover:bg-white/[0.02] transition-colors whitespace-nowrap"
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
                        <span className="ml-1 text-[9px] text-[#f59e0b] bg-[#f59e0b15] px-1 py-0.5 rounded">inv</span>
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${color}20`, color }}>
                        {STATUS_LABELS[s.status]}
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
                          title="View"
                          className="p-1 rounded text-[#6b7280] hover:text-[#4f8ef7] hover:bg-[rgba(79,142,247,0.1)] transition-all">
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => { setSelectedService(s); setDetailOpen(true) }}
                          title="Edit"
                          className="p-1 rounded text-[#6b7280] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.1)] transition-all">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(s)}
                          title="Duplicate"
                          className="p-1 rounded text-[#6b7280] hover:text-[#38d9a9] hover:bg-[rgba(56,217,169,0.1)] transition-all">
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => requestDelete(s)}
                          title="Delete"
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
          <span>Showing <span className="font-semibold text-[#e8eaf0]">{filtered.length}</span> of {services.length} services</span>
          {filtered.length > 0 && (
            <>
              <span className="text-[#2a2f3d]">|</span>
              <span>
                Total:{' '}
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
        title={`Delete Service #${confirmTarget?.serviceNumber}`}
        message={
          confirmTarget?.invoicedAt
            ? `This service is part of an invoice.\n\nAre you sure you want to delete it? This may affect billing records.`
            : `Are you sure you want to delete service #${confirmTarget?.serviceNumber}?\n\nThis action cannot be undone.`
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null) }}
      />
      <ConfirmModal
        open={bulkConfirmOpen}
        title={`Delete ${selectedCount} Service${selectedCount !== 1 ? 's' : ''}`}
        message={`Are you sure you want to delete ${selectedCount} selected service${selectedCount !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`}
        confirmLabel={bulkDeleting ? 'Deleting...' : `Delete ${selectedCount}`}
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
