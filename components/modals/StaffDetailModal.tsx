'use client'

import { useState } from 'react'
import { X, Pencil, Save, Mail, Phone, UserCheck, DollarSign, ShieldCheck, Calendar, AlertTriangle } from 'lucide-react'
import { PAY_FREQUENCIES } from './StaffModal'

const ROLE_COLORS: Record<string, string>   = { admin: '#4f8ef7', user: '#a78bfa' }
const STATUS_COLORS: Record<string, string> = { active: '#38d9a9', invited: '#f59e0b', inactive: '#6b7280' }

const IMMIGRATION_OPTIONS = [
  'US Citizen', 'Permanent Resident (Green Card)', 'TPS (Temporary Protected Status)',
  'DACA', 'H-2B Visa', 'H-1B Visa', 'EAD (Work Authorization)', 'Other',
]

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'

function fmtDate(val: string | null | undefined) {
  if (!val) return '—'
  const [y, m, d] = (val.split('T')[0]).split('-')
  return `${m}/${d}/${y}`
}

function toDateInput(val: string | null | undefined) {
  if (!val) return ''
  return new Date(val).toISOString().split('T')[0]
}

interface Props {
  member: any
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function StaffDetailModal({ member, open, onClose, onSuccess }: Props) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState<any>(null)

  function startEdit() { setForm({ ...member, password: '' }); setEditing(true) }

  function cancelEdit() { setEditing(false); setForm(null); setError('') }

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSuccess(); setEditing(false); setForm(null)
    } catch {
      setError('Failed to update. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !member) return null

  const data        = editing ? form : member
  const roleColor   = ROLE_COLORS[data?.role]   || '#6b7280'
  const statusColor = STATUS_COLORS[data?.status] || '#6b7280'
  const initials    = member.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const freqLabel   = PAY_FREQUENCIES.find(f => f.value === data?.scheduleType)?.label || '—'

  // Work permit expiry warning (≤30 days)
  const wpExpiry = data?.workPermitExpiry ? new Date(data.workPermitExpiry) : null
  const wpDaysLeft = wpExpiry ? Math.ceil((wpExpiry.getTime() - Date.now()) / 86400000) : null
  const wpWarning = wpDaysLeft !== null && wpDaysLeft <= 30

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
              {initials}
            </div>
            <div>
              <div className="text-sm font-bold text-[#e8eaf0]">{member.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold capitalize" style={{ color: roleColor }}>● {member.role}</span>
                <span className="text-[#2a2f3d]">·</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                <span className="text-[10px] capitalize" style={{ color: statusColor }}>{member.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all">
                <Pencil size={12} />Edit
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

          {/* Work permit expiry warning */}
          {!editing && wpWarning && (
            <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.25)] text-[#f59e0b] text-xs rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle size={13} />
              Work permit expires {wpDaysLeft !== null && wpDaysLeft <= 0 ? 'EXPIRED' : `in ${wpDaysLeft} day${wpDaysLeft === 1 ? '' : 's'}`} — {fmtDate(data?.workPermitExpiry)}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={LABEL}>Full Name</label>
            {editing
              ? <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className={INPUT} />
              : <div className="text-xs text-[#e8eaf0]">{data.name}</div>}
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}><Mail size={9} className="inline mr-1" />Email</label>
              {editing
                ? <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className={INPUT} />
                : <div className="text-xs text-[#e8eaf0]">{data.email || '—'}</div>}
            </div>
            <div>
              <label className={LABEL}><Phone size={9} className="inline mr-1" />Phone</label>
              {editing
                ? <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} className={INPUT} />
                : <div className="text-xs text-[#e8eaf0]">{data.phone || '—'}</div>}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className={LABEL}>Role</label>
            {editing ? (
              <div className="flex gap-2">
                {[{ value: 'admin', label: '👑 Admin', color: '#4f8ef7' }, { value: 'user', label: '👷 Staff', color: '#a78bfa' }].map(r => (
                  <button key={r.value} type="button" onClick={() => set('role', r.value)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                    style={form.role === r.value
                      ? { backgroundColor: `${r.color}15`, borderColor: r.color, color: r.color }
                      : { background: 'transparent', borderColor: '#2a2f3d', color: '#6b7280' }}>
                    {r.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs font-bold capitalize" style={{ color: roleColor }}>● {data.role}</div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className={LABEL}><UserCheck size={9} className="inline mr-1" />Status</label>
            {editing ? (
              <div className="flex gap-2">
                {[{ value: 'active', label: 'Active', color: '#38d9a9' }, { value: 'invited', label: 'Invited', color: '#f59e0b' }, { value: 'inactive', label: 'Inactive', color: '#f87171' }].map(s => (
                  <button key={s.value} type="button" onClick={() => set('status', s.value)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                    style={form.status === s.value
                      ? { backgroundColor: `${s.color}15`, borderColor: s.color, color: s.color }
                      : { background: 'transparent', borderColor: '#2a2f3d', color: '#6b7280' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs font-bold capitalize" style={{ color: statusColor }}>{data.status}</div>
            )}
          </div>

          {/* Reset Password */}
          {editing && (
            <div>
              <label className={LABEL}>Reset Password</label>
              <input type="text" value={form.password || ''} onChange={e => set('password', e.target.value)}
                placeholder="Leave blank to keep current password" className={INPUT} />
              <p className="text-[10px] text-[#6b7280] mt-1">Only fill this in to set a new password for this user.</p>
            </div>
          )}

          {/* ── Employee Info ── */}
          <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4 space-y-4">
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Employee Info</div>

            {editing ? (
              <>
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
                    <input type="text" value={form.taxId || ''} onChange={e => set('taxId', e.target.value)}
                      placeholder={form.taxIdType === 'SSN' ? 'XXX-XX-XXXX' : '9XX-XX-XXXX'}
                      className="flex-1 px-3 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                  </div>
                </div>

                {/* Immigration Status */}
                <div>
                  <label className={LABEL}>Immigration Status</label>
                  <select value={form.immigrationStatus || ''} onChange={e => set('immigrationStatus', e.target.value)} className={INPUT}>
                    <option value="">— Select —</option>
                    {IMMIGRATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Hire Date + DOB */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Hire Date</label>
                    <input type="date" value={toDateInput(form.hireDate)} onChange={e => set('hireDate', e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Date of Birth</label>
                    <input type="date" value={toDateInput(form.dateOfBirth)} onChange={e => set('dateOfBirth', e.target.value)} className={INPUT} />
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
                        <input type="date" value={toDateInput(form.workPermitExpiry)} onChange={e => set('workPermitExpiry', e.target.value)}
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
                    <input type="text" value={form.emergencyContactName || ''} onChange={e => set('emergencyContactName', e.target.value)}
                      placeholder="Full name" className={INPUT} />
                    <input type="tel" value={form.emergencyContactPhone || ''} onChange={e => set('emergencyContactPhone', e.target.value)}
                      placeholder="Phone number" className={INPUT} />
                  </div>
                </div>
              </>
            ) : (
              /* View mode */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Tax ID */}
                  <div>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">Tax ID</div>
                    <div className="text-xs text-[#e8eaf0]">
                      {data.taxId
                        ? <><span className="text-[10px] font-bold text-[#4f8ef7] mr-1.5">{data.taxIdType || 'SSN'}</span>{data.taxId}</>
                        : '—'}
                    </div>
                  </div>
                  {/* Immigration */}
                  <div>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">Immigration Status</div>
                    <div className="text-xs text-[#e8eaf0]">{data.immigrationStatus || '—'}</div>
                  </div>
                  {/* Hire Date */}
                  <div>
                    <div className="flex items-center gap-1 text-[10px] text-[#6b7280] mb-0.5">
                      <Calendar size={9} />Hire Date
                    </div>
                    <div className="text-xs text-[#e8eaf0]">{fmtDate(data.hireDate)}</div>
                  </div>
                  {/* DOB */}
                  <div>
                    <div className="flex items-center gap-1 text-[10px] text-[#6b7280] mb-0.5">
                      <Calendar size={9} />Date of Birth
                    </div>
                    <div className="text-xs text-[#e8eaf0]">{fmtDate(data.dateOfBirth)}</div>
                  </div>
                  {/* Work Permit */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 text-[10px] text-[#6b7280] mb-0.5">
                      <ShieldCheck size={9} />Work Permit
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {data.workPermit == null
                        ? <span className="text-xs text-[#e8eaf0]">—</span>
                        : data.workPermit
                          ? <>
                              <span className="text-xs font-semibold text-[#38d9a9]">✓ Yes</span>
                              {data.workPermitExpiry && (
                                <span className={`text-[10px] ${wpWarning ? 'text-[#f59e0b]' : 'text-[#6b7280]'}`}>
                                  {wpWarning && '⚠ '}Expires {fmtDate(data.workPermitExpiry)}
                                  {wpDaysLeft !== null && wpDaysLeft > 0 && ` (${wpDaysLeft}d)`}
                                </span>
                              )}
                            </>
                          : <span className="text-xs font-semibold text-[#f87171]">✗ No</span>}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                {(data.emergencyContactName || data.emergencyContactPhone) && (
                  <div className="border-t border-[#2a2f3d] pt-3">
                    <div className="text-[10px] text-[#6b7280] mb-1.5">Emergency Contact</div>
                    <div className="flex items-center gap-3 text-xs text-[#e8eaf0]">
                      {data.emergencyContactName && <span>{data.emergencyContactName}</span>}
                      {data.emergencyContactPhone && (
                        <span className="flex items-center gap-1 text-[#6b7280]">
                          <Phone size={9} />{data.emergencyContactPhone}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pay Settings */}
          <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-1.5">
              <DollarSign size={11} className="text-[#38d9a9]" />
              <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Pay Settings</span>
            </div>

            {editing ? (
              <>
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
                      <input type="number" min="0" step="0.01" value={form.hourlyRate || ''} onChange={e => set('hourlyRate', e.target.value)}
                        placeholder="600.00"
                        className="w-full pl-7 pr-3 py-2 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                    </div>
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
                        { key: 'extraFee', label: 'Extra Fee (Deep Clean/HDC)' },
                      ].map(({ key, label }) => {
                        const rates = (form.payRates as any) || {}
                        return (
                          <div key={key}>
                            <label className={LABEL}>{label}</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">$</span>
                              <input type="number" min="0" step="0.01" value={rates[key] ?? ''} onChange={e => set('payRates', { ...rates, [key]: e.target.value })}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              data.scheduleType === 'per_service' ? (
                <div>
                  <div className="text-[10px] text-[#6b7280] mb-2">Per Service Rates</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'per1BR', label: '1BR' }, { key: 'per2BR', label: '2BR' },
                      { key: 'per3BR', label: '3BR' }, { key: 'extraFee', label: 'Extra Fee' },
                    ].map(({ key, label }) => {
                      const val = (data.payRates as any)?.[key]
                      return (
                        <div key={key} className="bg-[#161922] rounded-lg px-3 py-2">
                          <div className="text-[10px] text-[#6b7280]">{label}</div>
                          <div className="text-xs font-bold text-[#38d9a9]">{val ? `$${Number(val).toLocaleString()}` : '—'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">Frequency</div>
                    <div className="text-xs font-semibold text-[#e8eaf0] capitalize">{freqLabel}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">Pay Amount</div>
                    <div className="text-xs font-semibold text-[#38d9a9]">
                      {data.hourlyRate ? `$${Number(data.hourlyRate).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes</label>
            {editing
              ? <textarea rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors resize-none" />
              : <div className="text-xs text-[#e8eaf0] whitespace-pre-wrap">{data.notes || <span className="text-[#6b7280]">—</span>}</div>}
          </div>
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
