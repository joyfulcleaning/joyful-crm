'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Save, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react'

// ─── Private Customer management identifier ────────────────────────────────────
export const PRIVATE_CUSTOMER_NAME = 'Private Customer'

// ─── Private Customer per-client price fields ──────────────────────────────────
export const PRIVATE_CUSTOMER_FIELDS = [
  { key: 'weekly',       label: 'Weekly'          },
  { key: 'biweekly',     label: 'Biweekly'        },
  { key: 'monthly',      label: 'Monthly'         },
  { key: 'deepCleanMin', label: 'Deep Clean From' },
  { key: 'deepCleanMax', label: 'Deep Clean To'   },
] as const

export type PrivatePriceKey = typeof PRIVATE_CUSTOMER_FIELDS[number]['key']

// ─── Price condition definitions ────────────────────────────────────────────────
export const PRICE_FIELDS = [
  { key: 'touchUp',         label: 'Touch-up',              hasFreq: false },
  { key: 'std1BR',          label: '1BR STD',               hasFreq: false },
  { key: 'std2BR',          label: '2BR STD',               hasFreq: false },
  { key: 'std3BR',          label: '3BR STD',               hasFreq: false },
  { key: 'deepCleanFee',    label: 'Deep Clean Fee',         hasFreq: false },
  { key: 'hdcFee',          label: 'HDC Fee',                hasFreq: false },
  { key: 'office',          label: 'Office',                 hasFreq: true  },
  { key: 'officeAlt',       label: 'Office (Alt)',           hasFreq: true  },
  { key: 'cancellationFee', label: 'Cancellation Fee',       hasFreq: false },
  { key: 'inspectionFee',   label: 'Inspection Fee',         hasFreq: false },
] as const

export type PriceKey = typeof PRICE_FIELDS[number]['key']

export type PriceCondition = {
  value: string
  frequency?: string
  active: boolean
}

export type PriceConditions = Record<PriceKey, PriceCondition>

const FREQ_OPTIONS = ['Weekly', 'Biweekly', 'Monthly']

function defaultConditions(): PriceConditions {
  const out: Partial<PriceConditions> = {}
  for (const f of PRICE_FIELDS) {
    out[f.key] = { value: '', active: false, ...(f.hasFreq ? { frequency: 'Weekly' } : {}) }
  }
  return out as PriceConditions
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (newId?: string) => void
  management?: any
}

export default function ManagementModal({ open, onClose, onSuccess, management }: Props) {
  const isEdit = !!management
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [conditions, setConditions] = useState<PriceConditions>(defaultConditions())

  // Load existing data when editing
  useEffect(() => {
    if (management) {
      setName(management.name ?? '')
      setNotes(management.notes ?? '')
      const base = defaultConditions()
      const saved = management.priceConditions ?? {}
      for (const f of PRICE_FIELDS) {
        if (saved[f.key]) base[f.key] = { ...base[f.key], ...saved[f.key] }
      }
      setConditions(base)
    } else {
      setName('')
      setNotes('')
      setConditions(defaultConditions())
    }
  }, [management, open])

  function toggle(key: PriceKey) {
    setConditions(c => ({ ...c, [key]: { ...c[key], active: !c[key].active } }))
  }

  function setValue(key: PriceKey, value: string) {
    setConditions(c => ({ ...c, [key]: { ...c[key], value } }))
  }

  function setFrequency(key: PriceKey, frequency: string) {
    setConditions(c => ({ ...c, [key]: { ...c[key], frequency } }))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return }
    setLoading(true)
    setError('')
    try {
      const url = isEdit ? `/api/management/${management.id}` : '/api/management'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), notes, priceConditions: conditions })
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      onSuccess(!isEdit ? created?.id : undefined)
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-[var(--text)]">
              {isEdit ? 'Edit Management' : 'New Management'}
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">
              Configure price conditions — activar los que apliquen
            </div>
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

          {/* Name */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
              Name <span className="text-[#f87171]">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Hawthorne, Greystar..."
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Price Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Price Conditions
              </label>
              <span className="text-[10px] text-[var(--muted)]">
                Activa los que aplican a este management
              </span>
            </div>

            <div className="space-y-2">
              {PRICE_FIELDS.map(field => {
                const cond = conditions[field.key]
                const isActive = cond.active
                return (
                  <div
                    key={field.key}
                    className={`rounded-xl border transition-all ${
                      isActive
                        ? 'border-[var(--accent)] bg-[rgba(74,63,176,0.08)]'
                        : 'border-[var(--border)] bg-[var(--surface2)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => toggle(field.key)}
                        className={`flex-shrink-0 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                      >
                        {isActive
                          ? <ToggleRight size={22} />
                          : <ToggleLeft size={22} />
                        }
                      </button>

                      {/* Label */}
                      <span className={`text-xs font-semibold w-36 flex-shrink-0 ${isActive ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
                        {field.label}
                      </span>

                      {/* Price input */}
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1">
                          <DollarSign size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                          <input
                            type="number"
                            value={cond.value}
                            onChange={e => setValue(field.key, e.target.value)}
                            placeholder="0"
                            disabled={!isActive}
                            className={`w-full pl-6 pr-2 py-1.5 rounded-lg text-xs border transition-all ${
                              isActive
                                ? 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none'
                                : 'bg-transparent border-transparent text-[var(--muted)] cursor-not-allowed'
                            }`}
                          />
                        </div>

                        {/* Frequency selector (only for office fields) */}
                        {field.hasFreq && (
                          <select
                            value={cond.frequency ?? 'Weekly'}
                            onChange={e => setFrequency(field.key, e.target.value)}
                            disabled={!isActive}
                            className={`px-2 py-1.5 rounded-lg text-xs border transition-all ${
                              isActive
                                ? 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]'
                                : 'bg-transparent border-transparent text-[var(--muted)] cursor-not-allowed'
                            }`}
                          >
                            {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
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
            {isEdit ? <Save size={13} /> : <Plus size={13} />}
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Management'}
          </button>
        </div>
      </div>
    </div>
  )
}
