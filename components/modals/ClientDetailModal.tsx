'use client'

import { useState, useEffect } from 'react'
import { X, Pencil, Save, Building2, Home, Phone, Mail, MapPin, Calendar, Layers } from 'lucide-react'
import { PRICE_FIELDS, PRIVATE_CUSTOMER_FIELDS, PRIVATE_CUSTOMER_NAME, type PriceConditions } from './ManagementModal'

const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

interface Props {
  client: any
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ClientDetailModal({ client, open, onClose, onSuccess }: Props) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [managements, setManagements] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/management')
        .then(r => r.json())
        .then(data => setManagements(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [open])

  function startEdit() {
    const priceRef: Record<string, string> = {}
    const isPC = client.management?.name === PRIVATE_CUSTOMER_NAME
    const fields = isPC ? PRIVATE_CUSTOMER_FIELDS : PRICE_FIELDS
    for (const f of fields) {
      const v = client.priceRef?.[f.key]
      priceRef[f.key] = v != null ? String(v) : ''
    }
    setForm({ ...client, priceRef, managementId: client.managementId ?? '' })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm(null)
    setError('')
  }

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  function setPriceRef(field: string, value: string) {
    setForm((f: any) => ({ ...f, priceRef: { ...f.priceRef, [field]: value } }))
  }

  function handleManagementChange(mgmtId: string) {
    if (!mgmtId) { set('managementId', ''); return }
    const mgmt = managements.find(m => m.id === mgmtId)

    if (mgmt?.name === PRIVATE_CUSTOMER_NAME) {
      setForm((f: any) => ({
        ...f,
        managementId: mgmtId,
        priceRef: { weekly: '', biweekly: '', monthly: '', deepCleanMin: '', deepCleanMax: '' },
      }))
      return
    }

    if (!mgmt?.priceConditions) { set('managementId', mgmtId); return }

    const conds: PriceConditions = mgmt.priceConditions
    const newPriceRef: Record<string, string> = {}
    for (const field of PRICE_FIELDS) {
      const cond = conds[field.key]
      if (cond?.active && cond.value) {
        newPriceRef[field.key] = field.hasFreq && cond.frequency
          ? `${cond.frequency} $${cond.value}`
          : cond.value
      } else {
        newPriceRef[field.key] = ''
      }
    }
    setForm((f: any) => ({ ...f, managementId: mgmtId, priceRef: newPriceRef }))
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const priceRef: Record<string, any> = {}
      Object.entries(form.priceRef).forEach(([k, v]) => {
        if (v) priceRef[k] = isNaN(Number(v)) ? v : parseFloat(v as string)
      })

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, managementId: form.managementId || null, priceRef })
      })
      if (!res.ok) throw new Error()
      onSuccess()
      setEditing(false)
      setForm(null)
    } catch {
      setError('Failed to update client. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !client) return null

  const data = editing ? form : client
  const isCommercial = data?.type === 'commercial'
  const typeColor = isCommercial ? '#38d9a9' : 'var(--accent)'
  const initials = client.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const currentMgmt = editing
    ? managements.find(m => m.id === form?.managementId)
    : client.management

  const isPrivateCustomer = (editing ? currentMgmt?.name : client.management?.name) === PRIVATE_CUSTOMER_NAME
  const priceEntries = Object.entries(data?.priceRef ?? {}).filter(([, v]) => v)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: `${typeColor}20`, color: typeColor }}
            >
              {initials}
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text)]">{client.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                {isCommercial ? <Building2 size={10} style={{ color: typeColor }} /> : <Home size={10} style={{ color: typeColor }} />}
                <span className="text-[10px] font-semibold capitalize" style={{ color: typeColor }}>{client.type}</span>
                <span className="text-[var(--border)] mx-1">·</span>
                <div className={`w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-[#38d9a9]' : 'bg-[var(--muted)]'}`} />
                <span className="text-[10px] text-[var(--muted)] capitalize">{client.status}</span>
                {currentMgmt && (
                  <>
                    <span className="text-[var(--border)] mx-1">·</span>
                    <Layers size={9} className="text-[var(--accent)]" />
                    <span className="text-[10px] text-[var(--accent)]">{currentMgmt.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                <Pencil size={12} />
                Edit
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-all"
              >
                Cancel
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-all">
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

          {/* Contact Info */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">Contact Information</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Name</label>
                {editing ? (
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.name || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Type</label>
                {editing ? (
                  <div className="flex gap-2">
                    {['residential', 'commercial'].map(t => (
                      <button key={t} type="button" onClick={() => set('type', t)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${
                          form.type === t
                            ? t === 'commercial' ? 'bg-[rgba(56,217,169,0.12)] border-[#38d9a9] text-[#38d9a9]' : 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                            : 'bg-transparent border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs capitalize" style={{ color: typeColor }}>{data.type || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                  <Phone size={9} className="inline mr-1" />Phone
                </label>
                {editing ? (
                  <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.phone || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                  <Mail size={9} className="inline mr-1" />Email
                </label>
                {editing ? (
                  <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.email || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Contact Name</label>
                {editing ? (
                  <input type="text" value={form.contactName || ''} onChange={e => set('contactName', e.target.value)}
                    placeholder="Property manager, POC..."
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.contactName || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Contact Phone</label>
                {editing ? (
                  <input type="tel" value={form.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)}
                    placeholder="(910) 555-0101"
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.contactPhone || '—'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Management */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
              <Layers size={9} className="inline mr-1" />Management
            </div>
            {editing ? (
              <div>
                <select
                  value={form.managementId ?? ''}
                  onChange={e => handleManagementChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  <option value="">— None —</option>
                  {managements.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {currentMgmt && (
                  <p className="text-[10px] text-[var(--accent)] mt-1">✓ Precios aplicados desde {currentMgmt.name}</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-[var(--text)]">
                {client.management?.name || <span className="text-[var(--muted)]">—</span>}
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
              <MapPin size={9} className="inline mr-1" />Address
            </div>
            {editing ? (
              <div className="space-y-3">
                <input type="text" value={form.address || ''} onChange={e => set('address', e.target.value)}
                  placeholder="Street address..."
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                <div className="grid grid-cols-3 gap-3">
                  {[['city','City'],['state','State'],['zip','ZIP']].map(([k,p]) => (
                    <input key={k} type="text" value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={p}
                      className="px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text)]">
                {[data.address, data.city, data.state, data.zip].filter(Boolean).join(', ') || '—'}
              </div>
            )}
          </div>

          {/* Property Code */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Property Code</div>
            {editing ? (
              <input
                type="text"
                value={form.propertyCode || ''}
                onChange={e => set('propertyCode', e.target.value)}
                placeholder="e.g. PROP-001"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            ) : (
              <div className="text-xs text-[var(--text)]">{data.propertyCode || '—'}</div>
            )}
          </div>

          {/* Service Details */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
              <Calendar size={9} className="inline mr-1" />Service Details
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Frequency</label>
                {editing ? (
                  <select value={form.frequency || ''} onChange={e => set('frequency', e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors">
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                ) : (
                  <div className="text-xs text-[var(--text)] capitalize">{data.frequency?.replace('_', '-') || '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Status</label>
                {editing ? (
                  <div className="flex gap-2">
                    {['active', 'inactive'].map(s => (
                      <button key={s} type="button" onClick={() => set('status', s)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${
                          form.status === s
                            ? s === 'active' ? 'bg-[rgba(56,217,169,0.12)] border-[#38d9a9] text-[#38d9a9]' : 'bg-[rgba(248,113,113,0.1)] border-[#f87171] text-[#f87171]'
                            : 'bg-transparent border-[var(--border)] text-[var(--muted)]'
                        }`}>{s}</button>
                    ))}
                  </div>
                ) : (
                  <div className={`text-xs capitalize ${data.status === 'active' ? 'text-[#38d9a9]' : 'text-[var(--muted)]'}`}>
                    {data.status || '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price Reference */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Price Reference</div>
              {editing && currentMgmt && !isPrivateCustomer && (
                <span className="text-[10px] text-[var(--accent)]">Auto-filled from {currentMgmt.name}</span>
              )}
            </div>
            {editing ? (
              isPrivateCustomer ? (
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
                            value={form?.priceRef?.[field.key] ?? ''}
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
                            value={form?.priceRef?.[field.key] ?? ''}
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
                    const val = form?.priceRef?.[field.key] ?? ''
                    const isFromMgmt = currentMgmt?.priceConditions?.[field.key]?.active
                    return (
                      <div key={field.key}>
                        <label className={`text-[10px] block mb-1 ${isFromMgmt ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                          {field.label}
                        </label>
                        <div className="relative">
                          {!field.hasFreq && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>}
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
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                {priceEntries.map(([k, v]) => {
                  const label =
                    PRICE_FIELDS.find(f => f.key === k)?.label ??
                    PRIVATE_CUSTOMER_FIELDS.find(f => f.key === k)?.label ??
                    k
                  const isNum = !isNaN(Number(v))
                  return (
                    <div key={k} className="px-3 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg">
                      <span className="text-[10px] text-[var(--muted)]">{label}</span>
                      <span className="text-xs font-bold text-[#38d9a9] ml-2">
                        {isNum ? `$${v}` : String(v)}
                      </span>
                    </div>
                  )
                })}
                {priceEntries.length === 0 && <span className="text-xs text-[var(--muted)]">No pricing set</span>}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Notes</div>
            {editing ? (
              <textarea
                value={form.notes || ''}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            ) : (
              <div className="text-xs text-[var(--muted)]">{data.notes || '—'}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        {editing && (
          <div className="sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-end gap-3">
            <button onClick={cancelEdit}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-all">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
              <Save size={13} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
