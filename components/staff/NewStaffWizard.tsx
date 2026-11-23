'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import StaffGroupSelect from '@/components/StaffGroupSelect'
import { PAY_FREQUENCIES } from '@/components/modals/StaffModal'
import { useI18n } from '@/lib/i18n'
import { EMPLOYMENT_TYPES, WEEK_DAYS, employeeCodeChoices } from '@/lib/staff-profile'
import { DEFAULT_PATTERN } from '@/lib/staff-absence'
import { STAFF_DOCUMENTS } from '@/lib/staff-documents'

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const INVALID = 'border-[#f87171] ring-2 ring-[rgba(248,113,113,0.15)]'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'

const IMMIGRATION_OPTIONS = [
  'US Citizen', 'Permanent Resident (Green Card)', 'TPS (Temporary Protected Status)',
  'DACA', 'H-2B Visa', 'H-1B Visa', 'EAD (Work Authorization)', 'Other',
]
const RATE_KEYS = ['per1BR', 'per2BR', 'per3BR', 'extraFee'] as const

const BLANK = {
  firstName: '', lastName: '', preferredName: '', dateOfBirth: '', taxIdType: 'SSN', taxId: '',
  immigrationStatus: '', workPermit: '', workPermitExpiry: '',
  phone: '', email: '', personalEmail: '', altPhone: '', addressLine: '', city: '', state: '', zipCode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  jobTitle: '', staffGroupId: '', employmentType: '', supervisorId: '', zone: '', hireDate: '', probationEndDate: '',
  role: 'user', rotating: 'false', hoursPerDay: String(DEFAULT_PATTERN.hoursPerDay), worksHolidays: 'false',
  workDays: [...DEFAULT_PATTERN.workDays] as string[],
  scheduleType: 'weekly', hourlyRate: '', per1BR: '', per2BR: '', per3BR: '', extraFee: '',
  bankName: '', bankRouting: '', bankAccount: '', vacationHours: '', sickHours: '', personalHours: '',
  received: [] as string[], password: '',
  employeeCode: '', // '' = the next automatic ID
}
type Form = typeof BLANK

// Required fields per step; the wizard can't move past a step until they're in.
const REQUIRED: (keyof Form)[][] = [
  ['firstName', 'lastName'],
  ['phone', 'email', 'emergencyContactName', 'emergencyContactPhone'],
  ['jobTitle', 'employmentType', 'hireDate'],
  [],
  [],
  [],
]

interface Props {
  staff:     any[]
  onClose:   () => void
  onCreated: (userId: string) => void
}

export default function NewStaffWizard({ staff, onClose, onCreated }: Props) {
  const { t } = useI18n()
  const w  = t.staffWizard
  const f  = t.staffHr.profile.fields
  const hr = t.staffHr

  const [form, setForm]       = useState<Form>({ ...BLANK })
  const [step, setStep]       = useState(0)
  const [reached, setReached] = useState(0)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [created, setCreated] = useState<{ id: string; tempPassword?: string } | null>(null)

  const set = (key: keyof Form, value: any) => setForm(prev => ({ ...prev, [key]: value }))
  const codes = employeeCodeChoices(staff.map(s => s.hrProfile?.employeeCode))

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const payOk = form.scheduleType === 'per_service' ? RATE_KEYS.some(k => form[k]) : !!form.hourlyRate
  const missingIn = (i: number) => {
    const fields = REQUIRED[i].filter(k => !String(form[k]).trim())
    if (i === 1 && form.email && !emailOk) fields.push('email')
    if (i === 3 && !payOk) fields.push('hourlyRate')
    return fields
  }
  const stepValid = (i: number) => missingIn(i).length === 0
  const bad = (key: keyof Form) => touched && missingIn(step).includes(key)

  function next() {
    if (!stepValid(step)) { setTouched(true); return }
    setTouched(false)
    const to = step + 1
    setStep(to); setReached(r => Math.max(r, to))
  }

  function goTo(i: number) {
    // Back freely; forward only through steps already passed.
    if (i <= reached && Array.from({ length: i }, (_, k) => k).every(stepValid)) { setStep(i); setTouched(false) }
  }

  const pendingRequired = STAFF_DOCUMENTS.filter(d => d.required && !form.received.includes(d.key)).length

  async function create() {
    const firstBad = [0, 1, 2, 3].find(i => !stepValid(i))
    if (firstBad !== undefined) { setStep(firstBad); setTouched(true); return }
    setSaving(true); setError('')
    try {
      const perService = form.scheduleType === 'per_service'
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: form.email, phone: form.phone, role: form.role, status: 'active',
          staffGroupId: form.staffGroupId || null,
          scheduleType: form.scheduleType,
          hourlyRate: perService ? null : form.hourlyRate,
          payRates: perService ? Object.fromEntries(RATE_KEYS.map(k => [k, form[k]])) : null,
          taxId: form.taxId, taxIdType: form.taxId ? form.taxIdType : null,
          immigrationStatus: form.immigrationStatus,
          hireDate: form.hireDate, dateOfBirth: form.dateOfBirth,
          workPermit: form.workPermit === '' ? null : form.workPermit === 'true',
          workPermitExpiry: form.workPermit === 'true' ? form.workPermitExpiry : '',
          emergencyContactName: form.emergencyContactName, emergencyContactPhone: form.emergencyContactPhone,
          password: form.password,
          employeeCode: form.employeeCode || null,
          receivedDocuments: form.received,
          profile: {
            preferredName: form.preferredName, jobTitle: form.jobTitle, employmentType: form.employmentType,
            supervisorId: form.supervisorId, zone: form.zone, probationEndDate: form.probationEndDate,
            personalEmail: form.personalEmail, altPhone: form.altPhone, addressLine: form.addressLine,
            city: form.city, state: form.state, zipCode: form.zipCode,
            bankName: form.bankName, bankRouting: form.bankRouting, bankAccount: form.bankAccount,
            vacationHours: form.vacationHours, sickHours: form.sickHours, personalHours: form.personalHours,
            weeklySchedule: {
              rotating: form.rotating, hoursPerDay: form.hoursPerDay, worksHolidays: form.worksHolidays,
              ...Object.fromEntries(WEEK_DAYS.map(d => [`work_${d}`, String(form.workDays.includes(d))])),
            },
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.code === 'code_taken') { setError(w.codeTaken); set('employeeCode', ''); setStep(2); return }
      if (res.status === 409) { setError(w.emailTaken); setStep(1); return }
      if (!res.ok) throw new Error()
      if (data.tempPassword) setCreated({ id: data.id, tempPassword: data.tempPassword })
      else onCreated(data.id)
    } catch {
      setError(w.error)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof Form, label: string, opts: { type?: string; required?: boolean; wide?: boolean } = {}) => (
    <div className={opts.wide ? 'col-span-full' : ''}>
      <label className={LABEL}>{label}{opts.required && <span className="text-[#f87171]"> *</span>}</label>
      <input type={opts.type || 'text'} value={form[key] as string} onChange={e => set(key, e.target.value)}
        min={opts.type === 'number' ? 0 : undefined} className={`${INPUT} ${bad(key) ? INVALID : ''}`} />
    </div>
  )
  const select = (key: keyof Form, label: string, options: { value: string; label: string }[], opts: { required?: boolean; blank?: boolean } = {}) => (
    <div>
      <label className={LABEL}>{label}{opts.required && <span className="text-[#f87171]"> *</span>}</label>
      <select value={form[key] as string} onChange={e => set(key, e.target.value)} className={`${INPUT} ${bad(key) ? INVALID : ''}`}>
        {opts.blank !== false && <option value="">—</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
  const yesNo = [{ value: 'true', label: t.staffHr.profile.yes }, { value: 'false', label: t.staffHr.profile.no }]

  if (created?.tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
        <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4 p-6 space-y-4">
          <div className="text-sm font-bold text-[#e8eaf0]">{w.tempPasswordTitle}</div>
          <p className="text-xs text-[#9ca3af]">{w.tempPasswordText}</p>
          <div className="flex items-center gap-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg px-3 py-2.5">
            <code className="flex-1 text-sm font-mono text-[#38d9a9] break-all">{created.tempPassword}</code>
            <button onClick={() => navigator.clipboard.writeText(created.tempPassword!)}
              className="px-2 py-1 text-[10px] font-semibold text-[#6b7280] hover:text-[#e8eaf0] border border-[#2a2f3d] rounded-md transition-colors shrink-0">
              {w.copy}
            </button>
          </div>
          <button onClick={() => onCreated(created.id)} className="w-full py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-sm font-semibold rounded-lg transition-colors">
            {w.done}
          </button>
        </div>
      </div>
    )
  }

  const groupName = (id: string) => staff.find(s => s.staffGroup?.id === id)?.staffGroup?.name
  const review: { step: number; rows: [string, string][] }[] = [
    { step: 0, rows: [[f.name, `${form.firstName} ${form.lastName}`], [f.preferredName, form.preferredName], [f.dateOfBirth, form.dateOfBirth], [f.taxId, form.taxId && `${form.taxIdType} ${form.taxId}`], [f.immigrationStatus, form.immigrationStatus]] },
    { step: 1, rows: [[f.email, form.email], [f.phone, form.phone], [f.addressLine, [form.addressLine, form.city, form.state, form.zipCode].filter(Boolean).join(', ')], [t.staffHr.profile.sections.emergency, [form.emergencyContactName, form.emergencyContactPhone].filter(Boolean).join(' · ')]] },
    { step: 2, rows: [[f.employeeCode, form.employeeCode || codes.next], [f.jobTitle, form.jobTitle], [f.group, groupName(form.staffGroupId) ?? ''], [f.employmentType, hr.employmentTypes[form.employmentType] ?? ''], [f.hireDate, form.hireDate], [f.role, t.staffHr.profile.roles[form.role]],
      [w.workDays, form.rotating === 'true' ? f.rotating : `${form.workDays.map(d => t.staffHr.profile.days[d]).join(', ')} · ${form.hoursPerDay} h`]] },
    { step: 3, rows: [[f.payType, PAY_FREQUENCIES.find(p => p.value === form.scheduleType)?.label ?? ''], [f.payAmount, form.scheduleType === 'per_service' ? RATE_KEYS.map(k => form[k] && `${f[k]}: $${form[k]}`).filter(Boolean).join(' · ') : form.hourlyRate && `$${form.hourlyRate}`],
      [t.staffHr.profile.sections.hours, [form.vacationHours, form.sickHours, form.personalHours].some(Boolean) ? `${form.vacationHours || 0} / ${form.sickHours || 0} / ${form.personalHours || 0}` : '']] },
    { step: 4, rows: [[t.staffDocs.tabInFile, `${form.received.length} / ${STAFF_DOCUMENTS.length} ${w.received.toLowerCase()}`]] },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4 overflow-hidden">
        <div className="border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between">
          <div className="text-sm font-bold text-[#e8eaf0]">{w.title}</div>
          <button onClick={onClose} aria-label={t.staffRecords.cancel} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all"><X size={16} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          <nav className="hidden md:block w-60 shrink-0 border-r border-[#2a2f3d] p-4 space-y-1">
            {w.steps.map((label, i) => {
              const done = i < reached && stepValid(i) && i !== step
              const locked = i > reached
              return (
                <button key={label} onClick={() => goTo(i)} disabled={locked}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-all ${
                    i === step ? 'bg-[rgba(79,142,247,0.1)] text-[#e8eaf0]' : 'text-[#6b7280] hover:text-[#e8eaf0]'
                  } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    done ? 'bg-[#38d9a9] text-[#0d0f14]' : i === step ? 'bg-[#4f8ef7] text-white' : 'bg-[#1e2330] text-[#6b7280]'
                  }`}>{done ? <Check size={12} /> : i + 1}</span>
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-4 md:hidden">{step + 1}/6 · {w.steps[step]}</div>
            {error && <div className="mb-4 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>}
            {touched && step === 1 && form.email && !emailOk && <div className="mb-4 text-xs text-[#f87171]">{w.invalidEmail}</div>}

            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('firstName', w.firstName, { required: true })}
                {field('lastName', w.lastName, { required: true })}
                {field('preferredName', f.preferredName)}
                {field('dateOfBirth', f.dateOfBirth, { type: 'date' })}
                {select('taxIdType', f.taxIdType, [{ value: 'SSN', label: 'SSN' }, { value: 'ITIN', label: 'ITIN' }], { blank: false })}
                {field('taxId', f.taxId)}
                {select('immigrationStatus', f.immigrationStatus, IMMIGRATION_OPTIONS.map(o => ({ value: o, label: o })))}
                {select('workPermit', f.workPermit, yesNo)}
                {form.workPermit === 'true' && field('workPermitExpiry', f.workPermitExpiry, { type: 'date' })}
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('email', w.loginEmail, { type: 'email', required: true })}
                {field('phone', f.phone, { type: 'tel', required: true })}
                {field('personalEmail', f.personalEmail, { type: 'email' })}
                {field('altPhone', f.altPhone, { type: 'tel' })}
                {field('addressLine', f.addressLine, { wide: true })}
                {field('city', f.city)}
                <div className="grid grid-cols-2 gap-4">
                  {field('state', f.state)}
                  {field('zipCode', f.zipCode)}
                </div>
                {field('emergencyContactName', f.emergencyName, { required: true })}
                {field('emergencyContactPhone', f.emergencyPhone, { type: 'tel', required: true })}
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {select('employeeCode', f.employeeCode, [
                  { value: '', label: `${codes.next} · ${w.codeAuto}` },
                  ...codes.free.map(code => ({ value: code, label: `${code} · ${w.codeFree}` })),
                ], { blank: false })}
                {field('jobTitle', f.jobTitle, { required: true })}
                <div>
                  <label className={LABEL}>{f.group}</label>
                  <StaffGroupSelect value={form.staffGroupId || null} onChange={id => set('staffGroupId', id ?? '')} className={INPUT} />
                </div>
                {select('employmentType', f.employmentType, EMPLOYMENT_TYPES.map(v => ({ value: v, label: hr.employmentTypes[v] })), { required: true })}
                {select('supervisorId', f.supervisor, staff.filter(s => s.status !== 'inactive').map(s => ({ value: s.id, label: s.name })))}
                {field('zone', f.zone)}
                {select('role', f.role, [{ value: 'user', label: t.staffHr.profile.roles.user }, { value: 'admin', label: t.staffHr.profile.roles.admin }], { blank: false })}
                {field('hireDate', f.hireDate, { type: 'date', required: true })}
                {field('probationEndDate', f.probationEndDate, { type: 'date' })}
                {select('rotating', f.rotating, yesNo, { blank: false })}
                {form.rotating !== 'true' && (
                  <>
                    {field('hoursPerDay', f.hoursPerDay, { type: 'number' })}
                    {select('worksHolidays', f.worksHolidays, yesNo, { blank: false })}
                    <div className="col-span-full">
                      <label className={LABEL}>{w.workDays}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEK_DAYS.map(d => {
                          const on = form.workDays.includes(d)
                          return (
                            <button key={d} type="button" onClick={() => set('workDays', on ? form.workDays.filter(x => x !== d) : [...form.workDays, d])}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                on ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                              }`}>{t.staffHr.profile.days[d]}</button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {select('scheduleType', f.payType, PAY_FREQUENCIES.map(p => ({ value: p.value, label: p.label })), { blank: false })}
                {form.scheduleType === 'per_service'
                  ? RATE_KEYS.map(k => <div key={k} className={touched && !payOk ? '[&_input]:border-[#f87171]' : ''}>{field(k, f[k], { type: 'number' })}</div>)
                  : field('hourlyRate', f.payAmount, { type: 'number', required: true })}
                {field('vacationHours', f.vacationHours, { type: 'number' })}
                {field('sickHours', f.sickHours, { type: 'number' })}
                {field('personalHours', f.personalHours, { type: 'number' })}
                {field('bankName', f.bankName)}
                {field('bankRouting', f.bankRouting)}
                {field('bankAccount', f.bankAccount)}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#6b7280] mb-3">{w.docsHint}</p>
                {STAFF_DOCUMENTS.map(d => {
                  const on = form.received.includes(d.key)
                  return (
                    <div key={d.key} className="flex items-center justify-between gap-3 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-3 py-2">
                      <div>
                        <div className="text-xs font-semibold text-[#e8eaf0]">{t.staffDocs.names[d.key]}</div>
                        <div className="text-[10px] text-[#6b7280]">{d.required ? t.staffDocs.required : t.staffDocs.optional}</div>
                      </div>
                      <div className="flex gap-1">
                        {[true, false].map(value => (
                          <button key={String(value)} type="button"
                            onClick={() => set('received', value ? [...form.received.filter(k => k !== d.key), d.key] : form.received.filter(k => k !== d.key))}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                              on === value
                                ? value ? 'bg-[rgba(56,217,169,0.15)] border-[#38d9a9] text-[#38d9a9]' : 'bg-[rgba(245,158,11,0.12)] border-[#f59e0b] text-[#f59e0b]'
                                : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                            }`}>
                            {value ? w.received : w.pending}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                {pendingRequired > 0 && (
                  <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.25)] text-[#f59e0b] text-xs rounded-lg p-3">{w.pendingRequired(pendingRequired)}</div>
                )}
                {review.map(block => (
                  <div key={block.step} className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#e8eaf0]">{w.steps[block.step]}</span>
                      <button onClick={() => setStep(block.step)} className="text-[11px] font-semibold text-[#4f8ef7] hover:underline">{w.editStep}</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {block.rows.map(([label, value]) => (
                        <div key={label} className="text-xs"><span className="text-[#6b7280]">{label}: </span><span className="text-[#e8eaf0]">{value || '—'}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label className={LABEL}>{w.passwordLabel}</label>
                  <input type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder={w.passwordHint} className={INPUT} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#2a2f3d] px-6 py-4 flex items-center justify-between gap-3">
          <button onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
            <ChevronLeft size={13} />{step === 0 ? t.staffRecords.cancel : w.back}
          </button>
          {step < 5 ? (
            <button onClick={next} className="flex items-center gap-1.5 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all">
              {w.next}<ChevronRight size={13} />
            </button>
          ) : (
            <button onClick={create} disabled={saving || (!!form.password && form.password.length < 8)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#38d9a9] hover:bg-[#2fc597] text-[#0d0f14] text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
              <Plus size={13} />{saving ? w.creating : w.create}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
