'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, CheckCircle, DollarSign } from 'lucide-react'
import SelectWithAdd from '@/components/ui/SelectWithAdd'

interface Payment {
  id: string
  amount: number
  method: string
  platform: string
  reference?: string
  notes?: string
  paidAt: string
  createdBy: { name: string }
}

interface Props {
  invoice: any
  open: boolean
  onClose: () => void
  onSuccess: (updatedInvoice: any) => void
}

const METHODS = ['cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'eft']
const PLATFORMS = ['other', 'stripe', 'square', 'cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card']

const inputCls = "w-full px-3 py-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
const labelCls = "text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5"

function formatDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${m}/${day}/${y}`
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function InvoicePaymentsModal({ invoice, open, onClose, onSuccess }: Props) {
  const [payments, setPayments]   = useState<Payment[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    amount:    '',
    method:    'zelle',
    platform:  'other',
    reference: '',
    notes:     '',
    paidAt:    new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (open && invoice?.id) loadPayments()
  }, [open, invoice?.id])

  async function loadPayments() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`)
      const data = await res.json()
      setPayments(data)
    } catch {}
    finally { setLoading(false) }
  }

  function setF(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAddPayment() {
    if (!form.amount || parseFloat(form.amount) <= 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    parseFloat(form.amount),
          method:    form.method,
          platform:  form.platform,
          reference: form.reference || null,
          notes:     form.notes || null,
          paidAt:    form.paidAt,
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      await loadPayments()
      onSuccess(data.invoice)
      setShowForm(false)
      setForm({ amount: '', method: 'zelle', platform: 'other', reference: '', notes: '', paidAt: new Date().toISOString().split('T')[0] })
    } catch {
      alert('Failed to add payment')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(paymentId: string) {
    if (!confirm('Delete this payment?')) return
    setDeletingId(paymentId)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      await loadPayments()
      onSuccess(data.invoice)
    } catch {
      alert('Failed to delete payment')
    } finally {
      setDeletingId(null)
    }
  }

  if (!open || !invoice) return null

  const total      = Number(invoice.total      || 0)
  const amountPaid = Number(invoice.amountPaid || 0)
  const balanceDue = Number(invoice.balanceDue ?? (total - amountPaid))
  const paidPct    = total > 0 ? Math.min(100, (amountPaid / total) * 100) : 0
  const isPaid     = balanceDue <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2f3d] flex-shrink-0">
          <div>
            <div className="text-sm font-bold text-[#e8eaf0]">Payments</div>
            <div className="text-xs text-[#6b7280] mt-0.5">
              {invoice.invoiceNumber} · {invoice.client?.name}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Balance summary */}
          <div className={`rounded-xl p-4 border ${isPaid ? 'bg-[#38d9a910] border-[#38d9a940]' : 'bg-[#0d0f14] border-[#2a2f3d]'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Balance Summary</div>
                {isPaid && (
                  <div className="flex items-center gap-1.5 text-[#38d9a9] text-xs font-bold">
                    <CheckCircle size={13} /> Fully Paid
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#6b7280]">Balance Due</div>
                <div className={`text-lg font-bold font-mono ${isPaid ? 'text-[#38d9a9]' : 'text-[#f87171]'}`}>
                  {fmt(balanceDue)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-[#2a2f3d] rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${paidPct}%`, background: isPaid ? '#38d9a9' : '#4f8ef7' }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-[#6b7280]">
              <span>Paid: <span className="text-[#38d9a9] font-mono font-bold">{fmt(amountPaid)}</span></span>
              <span>Total: <span className="text-[#e8eaf0] font-mono font-bold">{fmt(total)}</span></span>
            </div>
          </div>

          {/* Payment history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
                Payment History ({payments.length})
              </div>
              {!isPaid && (
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4f8ef720] border border-[#4f8ef7] text-[#4f8ef7] rounded-lg text-[10px] font-bold hover:bg-[#4f8ef740] transition-all"
                >
                  <Plus size={11} /> Add Payment
                </button>
              )}
            </div>

            {/* Add payment form */}
            {showForm && (
              <div className="mb-4 p-4 bg-[#0d0f14] border border-[#4f8ef740] rounded-xl space-y-3">
                <div className="text-[10px] font-bold text-[#4f8ef7] uppercase tracking-wider mb-2">New Payment</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Amount *</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setF('amount', e.target.value)}
                      placeholder={`Max ${fmt(balanceDue)}`}
                      className={inputCls}
                      step="0.01"
                      min="0.01"
                      max={balanceDue}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input
                      type="date"
                      value={form.paidAt}
                      onChange={e => setF('paidAt', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Method</label>
                    <SelectWithAdd
                      value={form.method}
                      onChange={v => setF('method', v)}
                      options={METHODS}
                      storageKey="paymentMethod"
                      addLabel="payment method"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Platform</label>
                    <SelectWithAdd
                      value={form.platform}
                      onChange={v => setF('platform', v)}
                      options={PLATFORMS}
                      storageKey="paymentPlatform"
                      addLabel="platform"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Reference / Confirmation #</label>
                  <input
                    value={form.reference}
                    onChange={e => setF('reference', e.target.value)}
                    placeholder="Transaction ID, check #, etc."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Notes</label>
                  <input
                    value={form.notes}
                    onChange={e => setF('notes', e.target.value)}
                    placeholder="Optional notes"
                    className={inputCls}
                  />
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2 flex-wrap">
                  <div className="text-[10px] text-[#6b7280] w-full">Quick:</div>
                  {[balanceDue, balanceDue / 2, balanceDue / 4].filter(v => v > 0).map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setF('amount', v.toFixed(2))}
                      className="px-2 py-1 text-[10px] bg-[#1e2330] border border-[#2a2f3d] rounded text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all"
                    >
                      {fmt(v)}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPayment}
                    disabled={saving || !form.amount}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <DollarSign size={12} />
                    {saving ? 'Saving...' : 'Apply Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Payments list */}
            {loading ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">No payments recorded yet</div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#38d9a920] flex items-center justify-center flex-shrink-0">
                        <DollarSign size={14} color="#38d9a9" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#38d9a9] font-mono">{fmt(Number(p.amount))}</div>
                        <div className="text-[10px] text-[#6b7280] capitalize">
                          {p.method} {p.platform !== 'other' ? `· ${p.platform}` : ''} · {formatDate(p.paidAt)}
                        </div>
                        {p.reference && (
                          <div className="text-[10px] text-[#4f8ef7]">Ref: {p.reference}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#f87171] hover:bg-[#f8717120] transition-all disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2f3d] flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#94a3b8] hover:text-[#e8eaf0] transition-colors">
            Close
          </button>
        </div>

      </div>
    </div>
  )
}