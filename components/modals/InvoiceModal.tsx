'use client'

import { useState, useEffect } from 'react'
import { X, Search, FileText, Check, SlidersHorizontal, GripVertical } from 'lucide-react'
import ClientModal from './ClientModal'
import SelectWithAdd from '@/components/ui/SelectWithAdd'

const PAYMENT_METHODS = [
  'cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'eft'
]

const PAYMENT_TERMS = [
  { label: 'Due on Receipt', days: 0 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
]

const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

const COL_DEFS = [
  { id: 'id',      label: 'ID',       defaultOn: true  },
  { id: 'date',    label: 'Date',     defaultOn: true  },
  { id: 'type',    label: 'Type',     defaultOn: true  },
  { id: 'unit',    label: 'Unit',     defaultOn: false },
  { id: 'room',    label: 'Room',     defaultOn: false },
  { id: 'time',    label: 'Time',     defaultOn: false },
  { id: 'staff',   label: 'Staff',    defaultOn: true  },
  { id: 'price',   label: 'Price',    defaultOn: true  },
  { id: 'fee',     label: 'Add. Fee', defaultOn: true  },
  { id: 'total',   label: 'Total',    defaultOn: true  },
  { id: 'payment', label: 'Payment',  defaultOn: true  },
  { id: 'status',  label: 'Status',   defaultOn: true  },
  { id: 'notes',   label: 'Notes',    defaultOn: false },
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function InvoiceModal({ open, onClose, onSuccess }: Props) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)

  function loadClients(autoSelectId?: string) {
    fetch('/api/clients').then(r => r.json()).then((c: any[]) => {
      setClients(c)
      if (autoSelectId) set('clientId', autoSelectId)
    }).catch(() => {})
  }
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(COL_DEFS.filter(c => c.defaultOn).map(c => c.id))
  )
  const [colOrder, setColOrder] = useState<string[]>(() => COL_DEFS.map(c => c.id))
  const [colsOpen, setColsOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const [paymentTerm, setPaymentTerm] = useState('')

  const [invMode, setInvMode] = useState<'auto' | 'manual'>('auto')
  const [invCode, setInvCode] = useState('')
  const [invNum, setInvNum] = useState('001')
  const [invYear, setInvYear] = useState(new Date().getFullYear().toString())
  const [invManualId, setInvManualId] = useState('')

  const [form, setForm] = useState({
    clientId: '',
    periodFrom: '',
    periodTo: '',
    serviceStatus: 'all',
    taxRate: '0',
    paymentMethod: '',
    notes: '',
    status: 'draft',
    dueDate: '',
  })

  useEffect(() => {
    if (!open) return
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => [])
  }, [open])

  // Auto-calculate due date from payment term
  useEffect(() => {
    if (!paymentTerm || !form.periodTo) return
    const term = PAYMENT_TERMS.find(t => t.label === paymentTerm)
    if (!term) return
    const date = new Date(form.periodTo + 'T12:00:00Z')
    date.setUTCDate(date.getUTCDate() + term.days)
    setForm(f => ({ ...f, dueDate: date.toISOString().split('T')[0] }))
  }, [paymentTerm, form.periodTo])

  // Auto-fill code when client selected
  useEffect(() => {
    if (form.clientId && invMode === 'auto') {
      const client = clients.find(c => c.id === form.clientId)
      if (client) {
        const code = client.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        setInvCode(code)
      }
    }
  }, [form.clientId, clients, invMode])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const invoiceNumber = invMode === 'auto'
    ? `${invCode || 'XX'}-${invNum}-${invYear}`
    : invManualId || 'INV-0001'

  async function handleSearch() {
    if (!form.clientId) { setError('Please select a client.'); return }
    setError('')
    setLoading(true)
    try {
      const all = await fetch('/api/services').then(r => r.json())
      let filtered = all.filter((s: any) => s.clientId === form.clientId)
      if (form.periodFrom) filtered = filtered.filter((s: any) => s.serviceDate >= form.periodFrom)
      if (form.periodTo) filtered = filtered.filter((s: any) => s.serviceDate <= form.periodTo + 'T23:59:59')
      if (form.serviceStatus !== 'all') filtered = filtered.filter((s: any) => s.status === form.serviceStatus)
      setResults(filtered)
      setSelected(new Set(filtered.map((s: any) => s.id)))
      setSearched(true)
    } catch (e) {
      setError('Failed to search services.')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(val: boolean) {
    if (val) setSelected(new Set(results.map(s => s.id)))
    else setSelected(new Set())
  }

  function toggleCol(id: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onDragStart(idx: number) { setDragIdx(idx) }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx) }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDropIdx(null); return }
    setColOrder(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIdx(null); setDropIdx(null)
  }
  function onDragEnd() { setDragIdx(null); setDropIdx(null) }

  function getColTdClass(colId: string): string {
    switch (colId) {
      case 'id':      return 'px-3 py-2 text-xs text-[#4f8ef7] font-mono'
      case 'date':    return 'px-3 py-2 text-xs text-[#9ca3af]'
      case 'type':    return 'px-3 py-2 text-xs text-[#e8eaf0]'
      case 'unit':    return 'px-3 py-2 text-xs text-[#9ca3af]'
      case 'room':    return 'px-3 py-2 text-xs text-[#9ca3af]'
      case 'time':    return 'px-3 py-2 text-xs text-[#9ca3af]'
      case 'staff':   return 'px-3 py-2 text-xs text-[#9ca3af]'
      case 'price':   return 'px-3 py-2 text-xs text-[#9ca3af] font-mono'
      case 'fee':     return 'px-3 py-2 text-xs text-[#f59e0b] font-mono'
      case 'total':   return 'px-3 py-2 text-xs font-bold text-[#38d9a9] font-mono'
      case 'payment': return 'px-3 py-2 text-xs text-[#6b7280] capitalize'
      case 'status':  return 'px-3 py-2'
      case 'notes':   return 'px-3 py-2 text-xs text-[#9ca3af] max-w-[140px] truncate'
      default:        return 'px-3 py-2 text-xs text-[#9ca3af]'
    }
  }

  function getCellContent(colId: string, s: any) {
    switch (colId) {
      case 'id':      return `#${s.serviceNumber}`
      case 'date':    return s.serviceDate ? (([y,m,d]) => `${m}/${d}/${y}`)(s.serviceDate.split('T')[0].split('-')) : '—'
      case 'type':    return s.type
      case 'unit':    return s.unit || '—'
      case 'room':    return s.roomSize || '—'
      case 'time':    return s.serviceTime || '—'
      case 'staff':   return s.staff?.length > 0 ? s.staff.map((st: any) => st.user?.name?.split(' ')[0]).join(', ') : '—'
      case 'price':   return `$${Number(s.basePrice).toFixed(2)}`
      case 'fee':     return Number(s.additionalFee) > 0 ? `+$${Number(s.additionalFee).toFixed(2)}` : '—'
      case 'total':   return `$${Number(s.total).toFixed(2)}`
      case 'payment': return s.paymentMethod || '—'
      case 'status':  return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
          style={{ backgroundColor: s.status === 'completed' ? 'rgba(56,217,169,0.1)' : 'rgba(245,158,11,0.1)', color: s.status === 'completed' ? '#38d9a9' : '#f59e0b' }}>
          {s.status?.replace('_', ' ')}
        </span>
      )
      case 'notes':   return s.notes || '—'
      default:        return null
    }
  }

  const selectedServices = results.filter(s => selected.has(s.id))
  const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.basePrice || 0), 0)
  const additionalFees = selectedServices.reduce((sum, s) => sum + Number(s.additionalFee || 0), 0)
  const taxAmount = (subtotal + additionalFees) * (parseFloat(form.taxRate) / 100)
  const total = subtotal + additionalFees + taxAmount

  async function handleGenerate() {
    if (selectedServices.length === 0) { setError('Select at least one service.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber,
          invoiceMode: invMode,
          clientId: form.clientId,
          issuedAt: new Date().toLocaleDateString('en-CA'),
          periodFrom: form.periodFrom || new Date().toLocaleDateString('en-CA'),
          periodTo: form.periodTo || new Date().toLocaleDateString('en-CA'),
          subtotal,
          additionalFees,
          taxRate: parseFloat(form.taxRate) || 0,
          taxAmount,
          total,
          paymentMethod: form.paymentMethod,
          status: form.status,
          dueDate: form.dueDate,
          notes: form.notes,
          items: selectedServices.map(s => ({
            description: `${s.type} - ${s.client?.name} (${s.serviceDate?.split('T')[0]})`,
            quantity: 1,
            unitPrice: Number(s.total),
            total: Number(s.total),
            serviceId: s.id,
          }))
        })
      })
      if (!res.ok) throw new Error('Failed')
      onSuccess()
      onClose()
      resetForm()
    } catch (e) {
      setError('Failed to generate invoice.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setPaymentTerm('')
    setForm({ clientId: '', periodFrom: '', periodTo: '', serviceStatus: 'all', taxRate: '0', paymentMethod: '', notes: '', status: 'draft', dueDate: '' })
    setResults([])
    setSelected(new Set())
    setSearched(false)
    setInvCode('')
    setInvNum('001')
    setError('')
  }

  const orderedCols = colOrder.map(id => COL_DEFS.find(c => c.id === id)!).filter(Boolean)
  const visibleOrderedCols = orderedCols.filter(c => visibleCols.has(c.id))

  if (!open) return null

  const inputCls = "w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
  const labelCls = "text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5"

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4 flex flex-col">
        {/* Header */}
        <div className="bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-[#4f8ef7]" />
            <div>
              <div className="text-sm font-bold text-[#e8eaf0]">New Invoice</div>
              <div className="text-[10px] text-[#6b7280] mt-0.5">Search services and generate invoice</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — Config */}
          <div className="w-80 flex-shrink-0 border-r border-[#2a2f3d] overflow-y-auto p-5 space-y-4">

            {error && (
              <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Invoice ID */}
            <div className="bg-[#1e2330] rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
                🏷 Invoice ID <span className="ml-1 px-1.5 py-0.5 bg-[#252b3b] rounded text-[#9ca3af]">Step 1</span>
              </div>

              {/* Preview / inline edit */}
              {invMode === 'manual' ? (
                <input
                  value={invManualId}
                  onChange={e => setInvManualId(e.target.value)}
                  placeholder="e.g. INV-2026-TC-008"
                  className="w-full text-center py-2 px-3 bg-[#0d0f14] rounded-lg border-2 border-[#4f8ef7] text-sm font-bold text-[#4f8ef7] focus:outline-none"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  autoFocus
                />
              ) : (
                <div className="text-center py-2 px-3 bg-[#161922] rounded-lg border border-[#2a2f3d]">
                  <span className="text-sm font-bold text-[#4f8ef7]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {invoiceNumber}
                  </span>
                </div>
              )}

              {/* Mode toggle */}
              <div className="flex gap-2">
                {[
                  { value: 'auto', label: '⚡ Auto' },
                  { value: 'manual', label: '✏️ Manual' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => setInvMode(m.value as 'auto' | 'manual')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      invMode === m.value
                        ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]'
                        : 'bg-transparent border-[#2a2f3d] text-[#6b7280]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {invMode === 'auto' && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Code</label>
                    <input value={invCode} onChange={e => setInvCode(e.target.value.toUpperCase())} maxLength={4}
                      className={inputCls + ' text-center font-mono font-bold'} placeholder="TC" />
                  </div>
                  <div>
                    <label className={labelCls}>No.</label>
                    <input value={invNum} onChange={e => setInvNum(e.target.value)} type="number"
                      className={inputCls + ' text-center font-mono font-bold'} />
                  </div>
                  <div>
                    <label className={labelCls}>Year</label>
                    <input value={invYear} onChange={e => setInvYear(e.target.value)} maxLength={4}
                      className={inputCls + ' text-center font-mono font-bold'} />
                  </div>
                </div>
              )}
            </div>

            {/* Search Filters */}
            <div className="bg-[#1e2330] rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
                🔍 Search Filters <span className="ml-1 px-1.5 py-0.5 bg-[#252b3b] rounded text-[#9ca3af]">Step 2</span>
              </div>

              <div>
                <label className={labelCls}>Client <span className="text-[#f87171]">*</span></label>
                <select
                  value={form.clientId}
                  onChange={e => {
                    if (e.target.value === '__add_client__') { setClientModalOpen(true); return }
                    set('clientId', e.target.value)
                  }}
                  className={inputCls}
                >
                  <option value="">— Select client —</option>
                  {clients.filter(c => c.status !== 'inactive').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__add_client__">+ New Client…</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>From</label>
                  <input type="date" value={form.periodFrom} onChange={e => set('periodFrom', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <input type="date" value={form.periodTo} onChange={e => set('periodTo', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Payment Terms</label>
                <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} className={inputCls}>
                  <option value="">— Select Payment Terms —</option>
                  {PAYMENT_TERMS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Service Status</label>
                <select value={form.serviceStatus} onChange={e => set('serviceStatus', e.target.value)} className={inputCls}>
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              <div className="border-t border-[#2a2f3d] pt-3 space-y-3">
                <div>
                  <label className={labelCls}>Tax (%)</label>
                  <input type="number" value={form.taxRate} onChange={e => set('taxRate', e.target.value)}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <SelectWithAdd
                    value={form.paymentMethod}
                    onChange={v => set('paymentMethod', v)}
                    options={PAYMENT_METHODS}
                    storageKey="paymentMethod"
                    placeholder="— Select Payment Method —"
                    addLabel="payment method"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Invoice Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                    {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    rows={2} placeholder="Additional notes..."
                    className={inputCls + ' resize-none'} />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                <Search size={13} />
                {loading ? 'Searching...' : 'Search Services'}
              </button>
            </div>
          </div>

          {/* RIGHT — Results */}
          <div className="flex-1 overflow-y-auto p-5">
            {!searched ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="text-5xl opacity-20 mb-4">🧾</div>
                <div className="text-sm text-[#6b7280]">Select a client and dates, then click Search Services</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Results header */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[#6b7280]">
                    Showing <strong className="text-[#e8eaf0]">{results.length} services</strong>
                    {form.clientId && clients.find(c => c.id === form.clientId) && (
                      <> · {clients.find(c => c.id === form.clientId)?.name}</>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    {/* Column picker */}
                    <div className="relative">
                      <button
                        onClick={() => setColsOpen(o => !o)}
                        className={`px-2 py-1 text-[10px] font-semibold border rounded-lg transition-all flex items-center gap-1 ${colsOpen ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]' : 'bg-[#1e2330] border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0]'}`}
                      >
                        <SlidersHorizontal size={10} />
                        Columns
                      </button>
                      {colsOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setColsOpen(false)} />
                          <div className="absolute right-0 top-8 z-20 bg-[#1a1f2e] border border-[#2a2f3d] rounded-xl shadow-2xl p-3 w-44">
                            <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">Visible Columns</div>
                            <div className="space-y-0.5">
                              {orderedCols.map((col, i) => (
                                <div
                                  key={col.id}
                                  draggable
                                  onDragStart={() => onDragStart(i)}
                                  onDragOver={e => onDragOver(e, i)}
                                  onDrop={() => onDrop(i)}
                                  onDragEnd={onDragEnd}
                                  className={`flex items-center gap-1.5 py-0.5 rounded px-1 transition-colors ${dragIdx === i ? 'opacity-40' : ''} ${dropIdx === i && dragIdx !== i ? 'bg-[rgba(79,142,247,0.12)] border border-[#4f8ef7]' : 'border border-transparent'}`}
                                >
                                  <GripVertical size={11} className="text-[#4b5563] cursor-grab flex-shrink-0" />
                                  <label className="flex items-center gap-2 cursor-pointer group flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={visibleCols.has(col.id)}
                                      onChange={() => toggleCol(col.id)}
                                      className="accent-[#4f8ef7] flex-shrink-0"
                                    />
                                    <span className="text-xs text-[#9ca3af] group-hover:text-[#e8eaf0] transition-colors truncate">{col.label}</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="w-px h-4 bg-[#2a2f3d]" />
                    <button onClick={() => toggleAll(true)}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-[#9ca3af] hover:text-[#e8eaf0] transition-all">
                      ☑ All
                    </button>
                    <button onClick={() => toggleAll(false)}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-[#9ca3af] hover:text-[#e8eaf0] transition-all">
                      ☐ None
                    </button>
                  </div>
                </div>

                {results.length === 0 ? (
                  <div className="text-center py-12 text-[#6b7280] text-xs">No services found for this criteria.</div>
                ) : (
                  <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#1e2330] border-b border-[#2a2f3d]">
                          <th className="px-3 py-2 w-8">
                            <input type="checkbox"
                              checked={selected.size === results.length && results.length > 0}
                              onChange={e => toggleAll(e.target.checked)}
                              className="accent-[#4f8ef7]"
                            />
                          </th>
                          {visibleOrderedCols.map(col => (
                            <th key={col.id} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((s: any) => (
                          <tr key={s.id} className={`border-t border-[#2a2f3d]/50 transition-colors ${selected.has(s.id) ? 'bg-[rgba(79,142,247,0.04)]' : 'hover:bg-white/[0.02]'}`}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="accent-[#4f8ef7]" />
                            </td>
                            {visibleOrderedCols.map(col => (
                              <td key={col.id} className={getColTdClass(col.id)}>
                                {getCellContent(col.id, s)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary bar */}
                {results.length > 0 && (
                  <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4 flex items-center gap-6 flex-wrap">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#e8eaf0]">{selected.size}</div>
                      <div className="text-[10px] text-[#6b7280]">Selected</div>
                    </div>
                    <div className="w-px h-8 bg-[#2a2f3d]" />
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#e8eaf0]">${subtotal.toFixed(2)}</div>
                      <div className="text-[10px] text-[#6b7280]">Subtotal</div>
                    </div>
                    <div className="w-px h-8 bg-[#2a2f3d]" />
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#f59e0b]">+${additionalFees.toFixed(2)}</div>
                      <div className="text-[10px] text-[#6b7280]">Add. Fees</div>
                    </div>
                    {parseFloat(form.taxRate) > 0 && (
                      <>
                        <div className="w-px h-8 bg-[#2a2f3d]" />
                        <div className="text-center">
                          <div className="text-lg font-bold text-[#9ca3af]">${taxAmount.toFixed(2)}</div>
                          <div className="text-[10px] text-[#6b7280]">Tax ({form.taxRate}%)</div>
                        </div>
                      </>
                    )}
                    <div className="w-px h-8 bg-[#2a2f3d]" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#38d9a9]">${total.toFixed(2)}</div>
                      <div className="text-[10px] text-[#6b7280]">TOTAL</div>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={handleGenerate}
                        disabled={loading || selected.size === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[#38d9a9] hover:bg-[#2bc090] text-[#0d0f14] text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                      >
                        <Check size={13} />
                        {loading ? 'Generating...' : 'Generate Invoice'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <ClientModal
      open={clientModalOpen}
      onClose={() => setClientModalOpen(false)}
      onSuccess={(newId) => { setClientModalOpen(false); loadClients(newId) }}
    />
    </>
  )
}