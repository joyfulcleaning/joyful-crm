'use client'

import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import ManagementModal, { PRICE_FIELDS, PRIVATE_CUSTOMER_FIELDS, PRIVATE_CUSTOMER_NAME, type PriceConditions } from './ManagementModal'

const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]


interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (newId?: string) => void
}

function emptyPriceRef() {
  return { touchUp: '', std1BR: '', std2BR: '', std3BR: '', deepCleanFee: '', hdcFee: '', office: '', officeAlt: '', cancellationFee: '', inspectionFee: '' }
}

export default function ClientModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managements, setManagements] = useState<any[]>([])
  const [mgmtModalOpen, setMgmtModalOpen] = useState(false)

  const [form, setForm] = useState({
    name: '',
    type: 'residential',
    phone: '',
    email: '',
    contactName: '',
    contactPhone: '',
    address: '',
    city: 'Fayetteville',
    state: 'NC',
    zip: '',
    propertyCode: '',
    frequency: 'biweekly',
    status: 'active',
    managementId: '',
    notes: '',
    priceRef: emptyPriceRef(),
  })

  function loadManagements(autoSelectId?: string) {
    fetch('/api/management')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setManagements(list)
        if (autoSelectId) handleManagementChange(autoSelectId)
      })
      .catch(() => {})
  }

  // Load management list
  useEffect(() => {
    if (open) loadManagements()
  }, [open])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setPriceRef(field: string, value: string) {
    setForm(f => ({ ...f, priceRef: { ...f.priceRef, [field]: value } }))
  }

  // Auto-populate prices when management is selected
  function handleManagementChange(mgmtId: string) {
    if (!mgmtId) { set('managementId', ''); return }

    const mgmt = managements.find(m => m.id === mgmtId)

    // Private Customer: each client has unique pricing — reset to private fields
    if (mgmt?.name === PRIVATE_CUSTOMER_NAME) {
      setForm(f => ({
        ...f,
        managementId: mgmtId,
        priceRef: { weekly: '', biweekly: '', monthly: '', deepCleanMin: '', deepCleanMax: '' } as any,
      }))
      return
    }

    if (!mgmt?.priceConditions) { set('managementId', mgmtId); return }

    const conds: PriceConditions = mgmt.priceConditions
    const newPriceRef = emptyPriceRef() as Record<string, string>

    for (const field of PRICE_FIELDS) {
      const cond = conds[field.key]
      if (cond?.active && cond.value) {
        if (field.hasFreq && cond.frequency) {
          newPriceRef[field.key] = `${cond.frequency} $${cond.value}`
        } else {
          newPriceRef[field.key] = cond.value
        }
      }
    }

    setForm(f => ({ ...f, managementId: mgmtId, priceRef: newPriceRef as typeof f.priceRef }))
  }

  function resetForm() {
    setForm({
      name: '', type: 'residential', phone: '', email: '',
      contactName: '', contactPhone: '',
      address: '', city: 'Fayetteville', state: 'NC', zip: '', propertyCode: '',
      frequency: 'biweekly', status: 'active', managementId: '', notes: '',
      priceRef: emptyPriceRef(),
    })
  }

  async function handleSubmit() {
    if (!form.name) { setError('Client name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const priceRef: Record<string, any> = {}
      Object.entries(form.priceRef).forEach(([k, v]) => {
        if (v) priceRef[k] = isNaN(Number(v)) ? v : parseFloat(v as string)
      })

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          managementId: form.managementId || null,
          priceRef,
        })
      })
      if (!res.ok) throw new Error('Failed to create client')
      const created = await res.json()
      onSuccess(created?.id)
      onClose()
      resetForm()
    } catch {
      setError('Failed to create client. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const selectedMgmt = managements.find(m => m.id === form.managementId)
  const isPrivateCustomer = selectedMgmt?.name === PRIVATE_CUSTOMER_NAME

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-[var(--text)]">New Client</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">Add a new client to the CRM</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                Name <span className="text-[#f87171]">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Client or property name..."
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Type</label>
              <div className="flex gap-2">
                {['residential', 'commercial'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${
                      form.type === t
                        ? t === 'commercial'
                          ? 'bg-[rgba(56,217,169,0.12)] border-[#38d9a9] text-[#38d9a9]'
                          : 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                        : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Management */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
              Management
            </label>
            <select
              value={form.managementId}
              onChange={e => {
                if (e.target.value === '__add_mgmt__') { setMgmtModalOpen(true); return }
                handleManagementChange(e.target.value)
              }}
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">— None —</option>
              {managements.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__add_mgmt__">+ New Management…</option>
            </select>
            {selectedMgmt && (
              <p className="text-[10px] text-[var(--accent)] mt-1">
                ✓ Precios aplicados desde {selectedMgmt.name}
              </p>
            )}
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(910) 555-0100"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="client@email.com"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Contact Name + Contact Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Contact Name</label>
              <input
                type="text"
                value={form.contactName}
                onChange={e => set('contactName', e.target.value)}
                placeholder="Property manager, POC..."
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Contact Phone</label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={e => set('contactPhone', e.target.value)}
                placeholder="(910) 555-0101"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="123 Main St..."
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* City + State + ZIP */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">State</label>
              <input
                type="text"
                value={form.state}
                onChange={e => set('state', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">ZIP</label>
              <input
                type="text"
                value={form.zip}
                onChange={e => set('zip', e.target.value)}
                placeholder="28301"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Property Code */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Property Code</label>
            <input
              type="text"
              value={form.propertyCode}
              onChange={e => set('propertyCode', e.target.value)}
              placeholder="e.g. PROP-001"
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Frequency + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Frequency</label>
              <select
                value={form.frequency}
                onChange={e => set('frequency', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                {FREQUENCIES.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Status</label>
              <div className="flex gap-2">
                {['active', 'inactive'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${
                      form.status === s
                        ? s === 'active'
                          ? 'bg-[rgba(56,217,169,0.12)] border-[#38d9a9] text-[#38d9a9]'
                          : 'bg-[rgba(248,113,113,0.1)] border-[#f87171] text-[#f87171]'
                        : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price Reference */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Price Reference
              </label>
              {selectedMgmt && !isPrivateCustomer && (
                <span className="text-[10px] text-[var(--accent)]">Auto-filled from {selectedMgmt.name}</span>
              )}
            </div>

            {isPrivateCustomer ? (
              <div className="space-y-3">
                <p className="text-[10px] text-[var(--muted)]">Precios individuales por frecuencia para este cliente</p>
                <div className="grid grid-cols-3 gap-3">
                  {PRIVATE_CUSTOMER_FIELDS.slice(0, 3).map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] text-[var(--muted)] block mb-1">{field.label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                        <input
                          type="number"
                          value={(form.priceRef as any)[field.key] ?? ''}
                          onChange={e => setPriceRef(field.key, e.target.value)}
                          placeholder="0"
                          className="w-full pl-5 pr-2 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {PRIVATE_CUSTOMER_FIELDS.slice(3).map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] text-[var(--muted)] block mb-1">{field.label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                        <input
                          type="number"
                          value={(form.priceRef as any)[field.key] ?? ''}
                          onChange={e => setPriceRef(field.key, e.target.value)}
                          placeholder="0"
                          className="w-full pl-5 pr-2 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {PRICE_FIELDS.map(field => {
                  const val = (form.priceRef as any)[field.key] ?? ''
                  const isFromMgmt = selectedMgmt &&
                    selectedMgmt.priceConditions?.[field.key]?.active &&
                    selectedMgmt.priceConditions?.[field.key]?.value
                  return (
                    <div key={field.key}>
                      <label className={`text-[10px] block mb-1 ${isFromMgmt ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                        {field.label}
                      </label>
                      <div className="relative">
                        {!field.hasFreq && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                        )}
                        <input
                          type={field.hasFreq ? 'text' : 'number'}
                          value={val}
                          onChange={e => setPriceRef(field.key, e.target.value)}
                          placeholder={field.hasFreq ? 'Weekly $0' : '0'}
                          className={`w-full ${!field.hasFreq ? 'pl-5' : 'pl-2'} pr-2 py-1.5 bg-[var(--surface2)] border rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none transition-colors ${
                            isFromMgmt ? 'border-[var(--accent)]' : 'border-[var(--border)] focus:border-[var(--accent)]'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Internal notes about this client..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--surface3)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            <Plus size={13} />
            {loading ? 'Creating...' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>

    <ManagementModal
      open={mgmtModalOpen}
      onClose={() => setMgmtModalOpen(false)}
      onSuccess={(newId) => { setMgmtModalOpen(false); loadManagements(newId) }}
    />
    </>
  )
}
