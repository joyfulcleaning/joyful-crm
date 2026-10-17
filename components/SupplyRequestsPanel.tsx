'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Package, Plus, Trash2, Truck, X } from 'lucide-react'
import { useSyncPoll } from '@/lib/useSyncPoll'
import { useI18n } from '@/lib/i18n'
import ErrorBanner from '@/components/ErrorBanner'

// The admin side of staff supply requests: see what was asked for, adjust the
// quantity actually being handed over (there may be less in stock than someone
// asked for), and dispatch — which deducts it from inventory server-side.

type Item = {
  id: string
  productId: string
  name: string
  sku: string
  category: string
  unitOfMeasure: string
  currentStock: number
  requestedQty: number
  deliveredQty: number | null
}

type SupplyRequest = {
  id: string
  code: string
  status: 'pending' | 'fulfilled' | 'rejected' | 'cancelled'
  note: string | null
  adminNote: string | null
  neededBy: string | null
  createdAt: string
  resolvedAt: string | null
  requestedBy: { id: string; name: string } | null
  resolvedBy: { id: string; name: string } | null
  items: Item[]
  totalRequested: number
  totalDelivered: number
  partial: boolean
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  fulfilled: '#26BD97',
  rejected: '#f87171',
  cancelled: '#6b7280',
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${m}-${d}-${y}`
}

// Same MM-DD-YYYY h:mm shape the requests page uses, kept local so this
// component doesn't import from a page module.
function formatDateTime(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${mm}-${dd}-${d.getFullYear()} ${time}`
}

export default function SupplyRequestsPanel() {
  const { t } = useI18n()
  const s = t.supplyRequestsPanel
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'fulfilled' | 'rejected'>('all')

  async function load() {
    try {
      const res = await fetch('/api/supply-requests')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || s.loadError)
      setRequests(Array.isArray(data) ? data : [])
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err.message || s.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useSyncPoll(['supplyRequests'], load)

  async function handleDelete(id: string) {
    if (!confirm(s.deleteConfirm)) return
    const res = await fetch(`/api/supply-requests/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== id))
      setOpenId(curr => curr === id ? null : curr)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || s.deleteFailed)
    }
  }

  function onResolved(updated: SupplyRequest) {
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    setOpenId(null)
  }

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
    rejected: requests.filter(r => r.status === 'rejected' || r.status === 'cancelled').length,
  }), [requests])

  const filtered = filter === 'all'
    ? requests
    : filter === 'rejected'
      ? requests.filter(r => r.status === 'rejected' || r.status === 'cancelled')
      : requests.filter(r => r.status === filter)

  const STATUS_LABELS: Record<string, string> = {
    pending: s.statusPending,
    fulfilled: s.statusFulfilled,
    rejected: s.statusRejected,
    cancelled: s.statusCancelled,
  }

  const open = requests.find(r => r.id === openId) || null

  return (
    <div className="space-y-4">
      {loadError && <ErrorBanner message={loadError} onRetry={load} />}
      <p className="text-xs text-[#6b7280]">{s.subtitle}</p>

      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'all' as const, label: s.filterAll, value: counts.all, color: '#6b7280' },
          { key: 'pending' as const, label: s.filterPending, value: counts.pending, color: '#f59e0b' },
          { key: 'fulfilled' as const, label: s.filterFulfilled, value: counts.fulfilled, color: '#26BD97' },
          { key: 'rejected' as const, label: s.filterRejected, value: counts.rejected, color: '#f87171' },
        ].map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className="bg-[#161922] border rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all"
            style={{ borderColor: filter === card.key ? card.color : '#2a2f3d' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: `${card.color}1a`, color: card.color }}>
              {card.value}
            </div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
          </button>
        ))}
      </div>

      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3d]">
              {[s.colDate, s.colStaff, s.colProducts, s.colQty, s.colStatus].map(h => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280] whitespace-nowrap">{h}</th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-[#6b7280] text-xs">{s.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-[#6b7280] text-xs px-6">
                {filter === 'all' ? s.empty : s.emptyFiltered(STATUS_LABELS[filter] || filter)}
              </td></tr>
            ) : filtered.map(r => {
              const color = STATUS_COLORS[r.status] || '#6b7280'
              const label = r.partial ? s.statusPartial : (STATUS_LABELS[r.status] || r.status)
              return (
                <tr
                  key={r.id}
                  className="border-b border-[#2a2f3d]/50 hover:bg-white/[0.04] transition-colors cursor-pointer"
                  onClick={() => setOpenId(r.id)}
                >
                  <td className="px-3 py-2.5 text-xs text-[#9ca3af] whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <div className="text-[#e8eaf0] font-medium">{r.requestedBy?.name || '—'}</div>
                    <div className="text-[#6b7280]">#{r.code}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#9ca3af] max-w-sm">
                    <div className="truncate">
                      {r.items.map(i => `${i.requestedQty}× ${i.name}`).join(', ')}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#e8eaf0] whitespace-nowrap">
                    {r.status === 'pending'
                      ? r.totalRequested
                      : s.deliveredOf(r.totalDelivered, r.totalRequested)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
                      {label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <button
                        title={s.viewAction}
                        onClick={e => { e.stopPropagation(); setOpenId(r.id) }}
                        className="text-[#6b7280] hover:text-[#4f8ef7] transition-colors"
                      >
                        <Package size={14} />
                      </button>
                      <button
                        title={s.deleteAction}
                        onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                        className="text-[#6b7280] hover:text-[#f87171] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && <DispatchModal request={open} onClose={() => setOpenId(null)} onResolved={onResolved} />}
    </div>
  )
}

function DispatchModal({ request, onClose, onResolved }: {
  request: SupplyRequest
  onClose: () => void
  onResolved: (r: SupplyRequest) => void
}) {
  const { t } = useI18n()
  const s = t.supplyRequestsPanel
  const isPending = request.status === 'pending'

  // Pre-filled with what's actually possible: what they asked for, capped by
  // what's on the shelf. That makes the common case one click, and the
  // short-stock case an obvious edit rather than a failed dispatch.
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(request.items.map(i => [
      i.id,
      i.deliveredQty ?? Math.min(i.requestedQty, i.currentStock),
    ]))
  )
  const [adminNote, setAdminNote] = useState(request.adminNote || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalDeliver = request.items.reduce((sum, i) => sum + (qty[i.id] ?? 0), 0)

  function setLine(item: Item, value: number) {
    // Can't promise more than was asked for, and can't hand over stock that
    // isn't there — the input itself enforces both bounds.
    const clamped = Math.max(0, Math.min(value, item.requestedQty, item.currentStock))
    setQty(prev => ({ ...prev, [item.id]: clamped }))
  }

  async function submit(action: 'fulfill' | 'reject') {
    if (action === 'fulfill' && totalDeliver === 0) { setError(s.nothingToDispatch); return }
    if (action === 'reject') {
      if (!confirm(s.declineConfirm)) return
    } else if (!confirm(s.dispatchConfirm(totalDeliver, request.requestedBy?.name || ''))) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/supply-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          adminNote,
          lines: request.items.map(i => ({ itemId: i.id, deliveredQty: qty[i.id] ?? 0 })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || s.updateFailed); return }
      onResolved(data)
    } catch {
      setError(s.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#2a2f3d] sticky top-0 bg-[#161922]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#7B72D8]">{s.requestLabel(request.code)}</div>
            <div className="text-base font-bold text-[#e8eaf0] mt-0.5">{request.requestedBy?.name || '—'}</div>
            <div className="text-[11px] text-[#6b7280] mt-0.5">
              {formatDateTime(request.createdAt)}
              {request.neededBy ? ` · ${s.neededBy(fmtDate(request.neededBy))}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {request.note && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">{s.staffNote}</div>
              <p className="text-xs text-[#e8eaf0] leading-relaxed">{request.note}</p>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">
              {isPending ? s.dispatchTitle : s.colProducts}
            </div>
            {isPending && <p className="text-[10px] text-[#6b7280] mb-3 leading-relaxed">{s.dispatchHint}</p>}

            <div className="space-y-2">
              {request.items.map(item => {
                const value = qty[item.id] ?? 0
                const short = item.currentStock < item.requestedQty
                return (
                  <div key={item.id} className="border border-[#2a2f3d] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#e8eaf0] truncate">{item.name}</div>
                        <div className="text-[10px] text-[#6b7280]">{item.sku} · {item.category}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-[#6b7280]">{s.requestedLabel}</div>
                        <div className="text-sm font-bold text-[#e8eaf0]">{item.requestedQty} {item.unitOfMeasure}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3">
                      <div className="text-[10px]" style={{ color: item.currentStock === 0 ? '#f87171' : short ? '#f59e0b' : '#6b7280' }}>
                        {item.currentStock === 0
                          ? s.outOfStock
                          : short ? s.onlyLeft(item.currentStock) : s.inStock(item.currentStock, item.unitOfMeasure)}
                      </div>

                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{s.deliverLabel}</span>
                          <div className="flex items-center border border-[#2a2f3d] rounded-lg overflow-hidden">
                            <button
                              onClick={() => setLine(item, value - 1)}
                              disabled={value <= 0}
                              className="px-2 py-1.5 text-[#9ca3af] hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              value={value}
                              min={0}
                              max={Math.min(item.requestedQty, item.currentStock)}
                              onChange={e => setLine(item, parseInt(e.target.value, 10) || 0)}
                              className="w-12 bg-transparent text-center text-sm font-bold text-[#e8eaf0] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => setLine(item, value + 1)}
                              disabled={value >= Math.min(item.requestedQty, item.currentStock)}
                              className="px-2 py-1.5 text-[#9ca3af] hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-bold" style={{ color: (item.deliveredQty ?? 0) > 0 ? '#26BD97' : '#6b7280' }}>
                          {(item.deliveredQty ?? 0) > 0
                            ? `${item.deliveredQty} ${item.unitOfMeasure}`
                            : s.none}
                        </div>
                      )}
                    </div>

                    {isPending && value < item.requestedQty && (
                      <div className="text-[10px] text-[#f59e0b] mt-2">
                        {value === 0 ? s.none : s.deliveredOf(value, item.requestedQty)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {isPending ? (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] block mb-1.5">
                {s.adminNoteLabel}
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder={s.adminNotePlaceholder}
                rows={2}
                className="w-full bg-[#0f1219] border border-[#2a2f3d] rounded-lg px-3 py-2 text-xs text-[#e8eaf0] placeholder:text-[#4b5563] outline-none focus:border-[#4A3FB0] resize-none"
              />
            </div>
          ) : (
            <>
              {request.adminNote && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">{s.adminNoteLabel}</div>
                  <p className="text-xs text-[#e8eaf0] leading-relaxed">{request.adminNote}</p>
                </div>
              )}
              <p className="text-[10px] text-[#6b7280]">
                {s.resolvedFooter(request.resolvedAt ? formatDateTime(request.resolvedAt) : '', request.resolvedBy?.name || '—')}
              </p>
            </>
          )}

          {error && (
            <div className="bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.35)] rounded-lg px-3 py-2 text-xs text-[#f87171]">
              {error}
            </div>
          )}
        </div>

        {isPending && (
          <div className="flex gap-2 px-5 py-4 border-t border-[#2a2f3d] sticky bottom-0 bg-[#161922]">
            <button
              onClick={() => submit('reject')}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#f87171] text-[#f87171] text-xs font-bold hover:bg-[rgba(248,113,113,0.1)] transition-colors disabled:opacity-50"
            >
              {s.declineAction}
            </button>
            <button
              onClick={() => submit('fulfill')}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4A3FB0] text-white text-xs font-bold hover:bg-[#5a4ec4] transition-colors disabled:opacity-50"
            >
              <Truck size={14} />
              {saving ? s.dispatching : s.dispatchAction}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
