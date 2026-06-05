'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export const PAY_FREQUENCIES = [
  { value: 'daily',       label: 'Daily',       std: 1  },
  { value: 'weekly',      label: 'Weekly',      std: 5  },
  { value: 'biweekly',    label: 'Biweekly',    std: 10 },
  { value: 'monthly',     label: 'Monthly',     std: 22 },
  { value: 'per_service', label: 'Per Service', std: 0  },
]

const IMMIGRATION_OPTIONS = [
  'US Citizen',
  'Permanent Resident (Green Card)',
  'TPS (Temporary Protected Status)',
  'DACA',
  'H-2B Visa',
  'H-1B Visa',
  'EAD (Work Authorization)',
  'Other',
]

const BLANK = {
  name: '', email: '', phone: '',
  role: 'user', status: 'active', password: 'joyful2026',
  scheduleType: 'weekly', hourlyRate: '',
  payRates: { per1BR: '', per2BR: '', per3BR: '', extraFee: '' },
  taxIdType: 'SSN', taxId: '',
  immigrationStatus: '',
  hireDate: '', dateOfBirth: '',
  workPermit: false, workPermitExpiry: '',
  emergencyContactName: '', emergencyContactPhone: '',
  notes: '',
}

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'

export default function StaffModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({ ...BLANK })

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setRate(key: string, value: string) {
    setForm(f => ({ ...f, payRates: { ...f.payRates, [key]: value } }))
  }

  async function handleSubmit() {
    if (!form.name || !form.email) { setError('Name and email are required.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSuccess(); onClose(); setForm({ ...BLANK })
    } catch {
      setError('Failed to create staff member. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-[#e8eaf0]">New Staff Member</div>
            <div className="text-[10px] text-[#6b7280] mt-0.5">Add a new team member</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={LABEL}>Full Name <span className="text-[#f87171]">*</span></label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ana Rodriguez..." className={INPUT} />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Email <span className="text-[#f87171]">*</span></label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="ana@joyfulservices.com" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="(910) 555-0100" className={INPUT} />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className={LABEL}>Role</label>
            <div className="flex gap-2">
              {[
                { value: 'admin', label: '👑 Admin', color: '#4f8ef7' },
                { value: 'user',  label: '👷 Staff',  color: '#a78bfa' },
              ].map(r => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    form.role === r.value ? 'border-current' : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                  }`}
                  style={form.role === r.value ? { backgroundColor: `${r.color}15`, borderColor: r.color, color: r.color } : {}}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={LABEL}>Status</label>
            <div className="flex gap-2">
              {[
                { value: 'active',   label: 'Active',   activeColor: '#38d9a9' },
                { value: 'invited',  label: 'Invited',  activeColor: '#f59e0b' },
                { value: 'inactive', label: 'Inactive', activeColor: '#f87171' },
              ].map(s => (
                <button key={s.value} type="button" onClick={() => set('status', s.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    form.status === s.value ? 'border-current' : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                  }`}
                  style={form.status === s.value ? { backgroundColor: `${s.activeColor}15`, borderColor: s.activeColor, color: s.activeColor } : {}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Employee Info ── */}
          <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4 space-y-4">
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Employee Info</div>

            {/* Tax ID */}
            <div>
              <label className={LABEL}>Tax ID</label>
              <div className="flex gap-2">
                {(['SSN', 'ITIN'] as const).map(t => (
                  <button key={t} type="button" onClick={() => set('taxIdType', t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      form.taxIdType === t
                        ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]'
                        : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                    }`}>
                    {t}
                  </button>
                ))}
                <input type="text" value={form.taxId} onChange={e => set('taxId', e.target.value)}
                  placeholder={form.taxIdType === 'SSN' ? 'XXX-XX-XXXX' : '9XX-XX-XXXX'}
                  className="flex-1 px-3 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>
            </div>

            {/* Immigration Status */}
            <div>
              <label className={LABEL}>Immigration Status</label>
              <select value={form.immigrationStatus} onChange={e => set('immigrationStatus', e.target.value)}
                className={INPUT}>
                <option value="">— Select —</option>
                {IMMIGRATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Hire Date + Date of Birth */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Hire Date</label>
                <input type="date" value={form.hireDate} onChange={e => set('hireDate', e.target.value)}
                  className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                  className={INPUT} />
              </div>
            </div>

            {/* Work Permit */}
            <div>
              <label className={LABEL}>Work Permit</label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-2">
                  {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(({ v, label }) => (
                    <button key={label} type="button" onClick={() => set('workPermit', v)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        form.workPermit === v
                          ? v ? 'bg-[rgba(56,217,169,0.15)] border-[#38d9a9] text-[#38d9a9]'
                              : 'bg-[rgba(248,113,113,0.15)] border-[#f87171] text-[#f87171]'
                          : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.workPermit && (
                  <div className="flex-1 min-w-32">
                    <input type="date" value={form.workPermitExpiry} onChange={e => set('workPermitExpiry', e.target.value)}
                      placeholder="Expiry date"
                      className="w-full px-3 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                    <p className="text-[9px] text-[#6b7280] mt-0.5">Expiry date (optional)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <label className={LABEL}>Emergency Contact</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)}
                  placeholder="Full name" className={INPUT} />
                <input type="tel" value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)}
                  placeholder="Phone number" className={INPUT} />
              </div>
            </div>
          </div>

          {/* Pay Settings */}
          <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4 space-y-4">
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Pay Settings</div>

            <div>
              <label className={LABEL}>Pay Type</label>
              <div className="grid grid-cols-5 gap-1.5">
                {PAY_FREQUENCIES.map(f => (
                  <button key={f.value} type="button" onClick={() => set('scheduleType', f.value)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                      form.scheduleType === f.value
                        ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]'
                        : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] hover:border-[#343c52]'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {form.scheduleType !== 'per_service' && (
              <div>
                <label className={LABEL}>
                  Pay Amount ({PAY_FREQUENCIES.find(f => f.value === form.scheduleType)?.label || ''})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">$</span>
                  <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)}
                    placeholder="600.00"
                    className="w-full pl-7 pr-3 py-2 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                </div>
                <p className="text-[10px] text-[#6b7280] mt-1">
                  {form.scheduleType === 'daily'    && 'Amount paid per day worked.'}
                  {form.scheduleType === 'weekly'   && 'Fixed amount paid every Friday.'}
                  {form.scheduleType === 'biweekly' && 'Fixed amount paid every 2 weeks.'}
                  {form.scheduleType === 'monthly'  && 'Fixed amount paid at end of month.'}
                </p>
              </div>
            )}

            {form.scheduleType === 'per_service' && (
              <div className="space-y-3">
                <p className="text-[10px] text-[#6b7280]">Amount paid per service completed, by room size.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'per1BR',   label: '1BR — per service' },
                    { key: 'per2BR',   label: '2BR — per service' },
                    { key: 'per3BR',   label: '3BR — per service' },
                    { key: 'extraFee', label: 'Extra Fee (Deep Clean / HDC)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className={LABEL}>{label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">$</span>
                        <input type="number" min="0" step="0.01" value={(form.payRates as any)[key]} onChange={e => setRate(key, e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes about this employee..."
              className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors resize-none" />
          </div>

          {/* Password */}
          <div>
            <label className={LABEL}>Temporary Password</label>
            <input type="text" value={form.password} onChange={e => set('password', e.target.value)}
              className={INPUT} />
            <p className="text-[10px] text-[#6b7280] mt-1">Staff member will use this to log in for the first time.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#161922] border-t border-[#2a2f3d] px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] hover:border-[#343c52] transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            <Plus size={13} />
            {loading ? 'Creating...' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
