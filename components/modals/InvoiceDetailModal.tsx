'use client'

import { useState, useEffect } from 'react'
import { X, Pencil, Save, FileText } from 'lucide-react'
import SelectWithAdd from '@/components/ui/SelectWithAdd'

const PAYMENT_METHODS = ['cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'eft']

const INVOICE_STATUSES = [
  { value: 'draft',     label: 'Draft',     color: '#9ca3af' },
  { value: 'sent',      label: 'Sent',      color: '#4f8ef7' },
  { value: 'paid',      label: 'Paid',      color: '#38d9a9' },
  { value: 'overdue',   label: 'Overdue',   color: '#f87171' },
  { value: 'cancelled', label: 'Cancelled', color: '#f87171' },
]

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface Props {
  invoice: any
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function InvoiceDetailModal({ invoice, open, onClose, onSuccess }: Props) {
  const [localInvoice, setLocalInvoice] = useState<any>(invoice)
  const [editing, setEditing]           = useState(false)
  const [loading, setLoading]           = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [error, setError]               = useState('')
  const [form, setForm]                 = useState<any>(null)
  const [quickPaidDate, setQuickPaidDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)

  // Sync local copy whenever the parent passes a new invoice (or modal opens)
  useEffect(() => {
    if (invoice) setLocalInvoice(invoice)
  }, [invoice])

  function startEdit() {
    setForm({
      status:         localInvoice.status,
      paymentMethod:  localInvoice.paymentMethod,
      dueDate:        localInvoice.dueDate?.split('T')[0] || '',
      paidAt:         localInvoice.paidAt?.split('T')[0] || '',
      notes:          localInvoice.notes || '',
      additionalFees: String(localInvoice.additionalFees || 0),
      taxRate:        String(localInvoice.taxRate || 0),
    })
    setEditing(true)
  }

  function cancelEdit() { setEditing(false); setForm(null); setError('') }

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/invoices/${localInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setLocalInvoice((prev: any) => ({ ...prev, ...updated }))
      setEditing(false); setForm(null)
      onSuccess()
    } catch {
      setError('Failed to update invoice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickStatus(newStatus: string, paidAt?: string) {
    setStatusLoading(true)
    setShowPaidConfirm(false)
    try {
      const res = await fetch(`/api/invoices/${localInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...(paidAt ? { paidAt } : {}) }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setLocalInvoice((prev: any) => ({ ...prev, ...updated }))
      onSuccess()
    } catch {
      setError('Failed to update status.')
    } finally {
      setStatusLoading(false)
    }
  }

  if (!open || !localInvoice) return null

  const display    = editing ? { ...localInvoice, ...form } : localInvoice
  const statusInfo = INVOICE_STATUSES.find(s => s.value === display.status) || INVOICE_STATUSES[0]
  const items      = localInvoice.items || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">

        {/* Header */}
        <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-[#4f8ef7]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#e8eaf0]">{localInvoice.invoiceNumber}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="text-[10px] text-[#6b7280] mt-0.5">
                {localInvoice.client?.name} · Issued {formatDate(localInvoice.issuedAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all">
                <Pencil size={12} /> Edit
              </button>
            ) : (
              <button onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
                Cancel
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Client + Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Client</label>
              <div className="text-xs text-[#e8eaf0]">{localInvoice.client?.name}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Period</label>
              <div className="text-xs text-[#e8eaf0]">{formatDate(localInvoice.periodFrom)} — {formatDate(localInvoice.periodTo)}</div>
            </div>
          </div>

          {/* Status + Payment Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Status</label>
              {editing ? (
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]">
                  {INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Payment Method</label>
              {editing ? (
                <SelectWithAdd
                  value={form.paymentMethod}
                  onChange={v => set('paymentMethod', v)}
                  options={PAYMENT_METHODS}
                  storageKey="paymentMethod"
                  addLabel="payment method"
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
                />
              ) : (
                <div className="text-xs text-[#e8eaf0] capitalize">{display.paymentMethod || '—'}</div>
              )}
            </div>
          </div>

          {/* Due Date + Paid On */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Due Date</label>
              {editing ? (
                <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
              ) : (
                <div className="text-xs text-[#e8eaf0]">{formatDate(display.dueDate)}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Paid On</label>
              {editing ? (
                <input type="date" value={form.paidAt} onChange={e => set('paidAt', e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
              ) : (
                <div className="text-xs font-semibold" style={{ color: display.paidAt ? '#38d9a9' : '#6b7280' }}>
                  {formatDate(display.paidAt)}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Notes</label>
            {editing ? (
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
            ) : (
              <div className="text-xs text-[#9ca3af]">{display.notes || '—'}</div>
            )}
          </div>

          {/* Items */}
          <div>
            <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-2">Items</label>
            <div className="bg-[#1e2330] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2f3d]">
                    {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4 text-[#6b7280] text-xs">No items</td></tr>
                  ) : items.map((item: any, i: number) => (
                    <tr key={i} className="border-t border-[#2a2f3d]/50">
                      <td className="px-3 py-2 text-xs text-[#e8eaf0]">{item.description}</td>
                      <td className="px-3 py-2 text-xs text-[#9ca3af]">{item.quantity}</td>
                      <td className="px-3 py-2 text-xs text-[#9ca3af] font-mono">${Number(item.unitPrice).toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs font-bold text-[#38d9a9] font-mono">${Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-[#1e2330] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#6b7280]">Subtotal</span>
              <span className="text-[#e8eaf0]">${Number(localInvoice.subtotal).toFixed(2)}</span>
            </div>
            {Number(localInvoice.additionalFees) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#6b7280]">Additional Fees</span>
                <span className="text-[#e8eaf0]">${Number(localInvoice.additionalFees).toFixed(2)}</span>
              </div>
            )}
            {Number(localInvoice.taxRate) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#6b7280]">Tax ({localInvoice.taxRate}%)</span>
                <span className="text-[#e8eaf0]">${Number(localInvoice.taxAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-[#2a2f3d] pt-2 flex justify-between">
              <span className="text-sm font-bold text-[#e8eaf0]">Total</span>
              <span className="text-sm font-bold text-[#38d9a9]">${Number(localInvoice.total).toFixed(2)}</span>
            </div>
          </div>

          {/* Quick Status Update */}
          {!editing && (
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-2">Quick Status Update</label>
              <div className="flex gap-2 flex-wrap">
                {INVOICE_STATUSES.filter(s => s.value !== display.status).map(s => (
                  <button
                    key={s.value}
                    onClick={() => {
                      if (s.value === 'paid') {
                        setQuickPaidDate(new Date().toLocaleDateString('en-CA'))
                        setShowPaidConfirm(true)
                      } else {
                        handleQuickStatus(s.value)
                      }
                    }}
                    disabled={statusLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
                    style={{ backgroundColor: `${s.color}15`, borderColor: s.color, color: s.color }}
                  >
                    → {s.label}
                  </button>
                ))}
              </div>

              {/* Payment date picker — shown when marking as paid */}
              {showPaidConfirm && (
                <div className="mt-3 flex items-center gap-3 p-3 bg-[rgba(56,217,169,0.07)] border border-[rgba(56,217,169,0.25)] rounded-xl">
                  <div className="flex-1">
                    <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">Fecha de pago</div>
                    <input
                      type="date"
                      value={quickPaidDate}
                      onChange={e => setQuickPaidDate(e.target.value)}
                      className="px-3 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#38d9a9] w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-4">
                    <button
                      onClick={() => handleQuickStatus('paid', quickPaidDate)}
                      disabled={statusLoading}
                      className="px-3 py-1.5 bg-[#38d9a9] hover:bg-[#2bc090] text-[#0d0f14] text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                      {statusLoading ? '...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setShowPaidConfirm(false)}
                      className="px-3 py-1.5 text-[#6b7280] text-xs hover:text-[#e8eaf0] transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div className="sticky bottom-0 bg-[#161922] border-t border-[#2a2f3d] px-6 py-4 flex items-center justify-end gap-3">
            <button onClick={cancelEdit}
              className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
              <Save size={13} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
