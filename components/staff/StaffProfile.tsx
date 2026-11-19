'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Phone, Save } from 'lucide-react'
import StaffGroupSelect from '@/components/StaffGroupSelect'
import ProfileAbsences from '@/components/staff/ProfileAbsences'
import ProfileDocuments from '@/components/staff/ProfileDocuments'
import ProfileHistory from '@/components/staff/ProfileHistory'
import RecordSection from '@/components/staff/RecordSection'
import { complianceOf } from '@/lib/staff-documents'
import { reviewAverage } from '@/lib/staff-records'
import { DEFAULT_PATTERN, coversDay } from '@/lib/staff-absence'
import { PAY_FREQUENCIES } from '@/components/modals/StaffModal'
import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import {
  EMPLOYMENT_TYPES, STAFF_STATUS_COLORS, WEEK_DAYS,
  completeness, fmtDate, initialsOf, isOnProbation, missingFields, payText, permitExpiringSoon, tenure,
} from '@/lib/staff-profile'

const IMMIGRATION_OPTIONS = [
  'US Citizen', 'Permanent Resident (Green Card)', 'TPS (Temporary Protected Status)',
  'DACA', 'H-2B Visa', 'H-1B Visa', 'EAD (Work Authorization)', 'Other',
]
const SCHEDULE_VISIBILITY_OPTIONS = ['1', '2', '3', '4', 'week', 'full']
const SCHEDULE_PAST_OPTIONS       = ['0', 'week', '7', '14', '30']

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'
const CARD  = 'bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden'
const CARD_HEAD = 'px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between gap-3'
const CARD_TITLE = 'text-sm font-bold text-[#e8eaf0]'

type TabKey = 'summary' | 'personal' | 'employment' | 'compensation' | 'absences' | 'documents' | 'performance' | 'equipment' | 'notes'

interface Field {
  // 'phone' is a User column; 'profile.x', 'schedule.mon' and 'rate.per1BR'
  // live inside hrProfile, its weeklySchedule, and payRates.
  key:       string
  label:     string
  type?:     'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'bool' | 'group'
  options?:  { value: string; label: string }[]
  required?: boolean
  wide?:     boolean
  // Never shown back, only ever set (the password).
  writeOnly?: boolean
  hint?:     string
  // Shown and edited when nothing is stored yet.
  fallback?: string
  showIf?:   (values: Record<string, string>) => boolean
  display?:  (member: any) => string
}

function readValue(member: any, key: string) {
  const [scope, name] = key.split('.')
  if (scope === 'profile')  return member.hrProfile?.[name]
  if (scope === 'schedule') return member.hrProfile?.weeklySchedule?.[name]
  if (scope === 'rate')     return member.payRates?.[name]
  return member[key]
}

function toFormValue(member: any, field: Field) {
  if (field.writeOnly) return ''
  const value = readValue(member, field.key)
  if (value === null || value === undefined) return field.fallback ?? ''
  if (field.type === 'date') return String(value).slice(0, 10)
  return String(value)
}

// Only the fields that changed go to the server, so a save can't touch
// anything outside the section being edited.
function buildPatch(member: any, changed: [Field, string][]) {
  const body: any = {}
  for (const [field, value] of changed) {
    const [scope, name] = field.key.split('.')
    if (scope === 'profile') {
      body.profile = { ...body.profile, [name]: value }
    } else if (scope === 'schedule') {
      const week = body.profile?.weeklySchedule ?? member.hrProfile?.weeklySchedule ?? {}
      body.profile = { ...body.profile, weeklySchedule: { ...week, [name]: value } }
    } else if (scope === 'rate') {
      body.payRates = { ...(body.payRates ?? member.payRates ?? {}), [name]: value }
    } else if (field.type === 'bool') {
      body[field.key] = value === '' ? null : value === 'true'
    } else {
      body[field.key] = value
    }
  }
  return body
}

interface SectionProps {
  title:   string
  member:  any
  fields:  Field[]
  columns?: 2 | 4 | 7
  onSaved: (updated: any) => void
}

function Section({ title, member, fields, columns = 2, onSaved }: SectionProps) {
  const { t } = useI18n()
  const hr = t.staffHr.profile
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const currentValues = () => Object.fromEntries(fields.map(f => [f.key, toFormValue(member, f)]))
  const shown = fields.filter(f => !f.showIf || f.showIf(values ?? currentValues()))

  function cancel() { setValues(null); setError('') }

  async function save() {
    if (!values) return
    const missing = shown.find(f => f.required && !values[f.key].trim())
    if (missing) { setError(hr.requiredError(missing.label)); return }

    const original = currentValues()
    const changed = shown
      .filter(f => values[f.key] !== original[f.key])
      .map(f => [f, values[f.key]] as [Field, string])
    if (changed.length === 0) { cancel(); return }

    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatch(member, changed)),
      })
      if (!res.ok) throw new Error()
      onSaved(await res.json())
      setValues(null)
    } catch {
      setError(hr.saveError)
    } finally {
      setSaving(false)
    }
  }

  function renderInput(f: Field) {
    const value = values![f.key]
    const set = (v: string) => setValues(prev => ({ ...prev!, [f.key]: v }))
    if (f.type === 'textarea') return <textarea rows={3} value={value} onChange={e => set(e.target.value)} className={`${INPUT} resize-none`} />
    if (f.type === 'group') return <StaffGroupSelect value={value || null} onChange={id => set(id ?? '')} className={INPUT} />
    if (f.type === 'bool') {
      return (
        <select value={value} onChange={e => set(e.target.value)} className={INPUT}>
          {!f.required && <option value="">—</option>}
          <option value="true">{hr.yes}</option>
          <option value="false">{hr.no}</option>
        </select>
      )
    }
    if (f.type === 'select') {
      return (
        <select value={value} onChange={e => set(e.target.value)} className={INPUT}>
          {!f.required && <option value="">—</option>}
          {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    return (
      <input
        type={f.type || 'text'}
        min={f.type === 'number' ? 0 : undefined}
        step={f.type === 'number' ? 'any' : undefined}
        value={value}
        placeholder={f.hint}
        onChange={e => set(e.target.value)}
        className={INPUT}
      />
    )
  }

  function displayValue(f: Field) {
    if (f.display) return f.display(member)
    const raw = readValue(member, f.key) ?? f.fallback
    if (raw === null || raw === undefined || raw === '') return '—'
    if (f.type === 'date') return fmtDate(String(raw))
    if (f.type === 'bool') return String(raw) === 'true' ? hr.yes : hr.no
    if (f.type === 'select') return f.options?.find(o => o.value === String(raw))?.label ?? String(raw)
    return String(raw)
  }

  const grid = columns === 7 ? 'grid-cols-2 md:grid-cols-7' : columns === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div className={CARD}>
      <div className={CARD_HEAD}>
        <span className={CARD_TITLE}>{title}</span>
        {!values && (
          <button
            onClick={() => setValues(currentValues())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all"
          >
            <Pencil size={12} />{hr.edit}
          </button>
        )}
      </div>
      <div className="p-4">
        {error && (
          <div className="mb-3 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>
        )}
        <div className={`grid ${grid} gap-x-6 gap-y-4`}>
          {shown.filter(f => values || !f.writeOnly).map(f => (
            <div key={f.key} className={f.wide ? 'col-span-full' : ''}>
              {values
                ? <><label className={LABEL}>{f.label}</label>{renderInput(f)}</>
                : <>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">{f.label}</div>
                    <div className="text-xs text-[#e8eaf0] whitespace-pre-wrap break-words">{displayValue(f)}</div>
                  </>}
            </div>
          ))}
        </div>
      </div>
      {values && (
        <div className="px-4 py-3 border-t border-[#2a2f3d] flex items-center justify-end gap-3">
          <button onClick={cancel} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
            {hr.cancel}
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            <Save size={13} />{saving ? hr.saving : hr.save}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  member:   any
  staff:    any[]
  absences: any[]
  documents: any[]
  onDocumentsChanged: () => void
  onOpenAbsence:     (absence: any) => void
  onRegisterAbsence: () => void
  onBack:   () => void
  onSelect: (member: any) => void
  onSaved:  (updated: any) => void
  visibilitySaving: boolean
  onVisibilityChange: (memberId: string, value: string, field: 'future' | 'past') => void
}

export default function StaffProfile({ member, staff, absences, documents, onDocumentsChanged, onOpenAbsence, onRegisterAbsence, onBack, onSelect, onSaved, visibilitySaving, onVisibilityChange }: Props) {
  const { t } = useI18n()
  const hrRoot = t.staffHr
  const hr     = hrRoot.profile
  const f      = hr.fields
  const today  = localDateStr()
  const [tab, setTab] = useState<TabKey>('summary')
  // Tagged with whose they are, so a file never shows the previous person's
  // records while the next person's are still loading.
  const [recordsOf, setRecordsOf] = useState<{ userId: string; items: any[] } | null>(null)
  const [historyOf, setHistoryOf] = useState<{ userId: string; audit: any[]; stats: any } | null>(null)
  const records = recordsOf && recordsOf.userId === member.id ? recordsOf.items : []
  const history = historyOf && historyOf.userId === member.id ? historyOf : null

  function loadRecords() {
    const userId = member.id
    fetch(`/api/staff/${userId}/records`).then(r => r.ok ? r.json() : []).then(items => setRecordsOf({ userId, items })).catch(() => {})
  }
  function loadHistory() {
    const userId = member.id
    fetch(`/api/staff/${userId}/history`).then(r => r.ok ? r.json() : null).then(h => h && setHistoryOf({ userId, ...h })).catch(() => {})
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRecords() }, [member.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'performance' || tab === 'notes') loadHistory() }, [tab, member.id])

  function recordsChanged() { loadRecords(); if (tab === 'performance' || tab === 'notes') loadHistory() }

  const p          = member.hrProfile
  const index      = staff.findIndex(m => m.id === member.id)
  const pct        = completeness(member)
  const missing    = missingFields(member)
  const permitDue  = permitExpiringSoon(member, today)
  const onLeave    = absences.some(a => a.userId === member.id && a.status === 'approved' && coversDay(a, today))
  const statusKey  = onLeave ? 'on_leave' : isOnProbation(member, today) ? 'probation' : member.status
  const statusColor = STAFF_STATUS_COLORS[statusKey] || '#6b7280'
  const statusLabel = onLeave ? t.staffAbsence.onLeave : (hrRoot.chips as Record<string, string>)[statusKey] || member.status
  const supervisor = staff.find(m => m.id === p?.supervisorId)?.name || '—'
  const since      = member.hireDate ? tenure(member.hireDate, today) : null
  const sinceText  = since ? hrRoot.tenure(since.years, since.months) : '—'
  const pay        = payText(member, hrRoot)
  const typeLabel  = hrRoot.employmentTypes[p?.employmentType]

  const headline = [p?.jobTitle, member.staffGroup?.name, typeLabel, p?.preferredName && hr.prefers(p.preferredName)]
    .filter(Boolean).join(' · ')

  const heroMeta = [
    { label: f.tenure,     value: sinceText },
    { label: f.hireDate,   value: fmtDate(member.hireDate) },
    { label: f.supervisor, value: supervisor },
    { label: hrRoot.columns.rate, value: pay },
    { label: f.phone,      value: member.phone || '—' },
    { label: f.email,      value: member.email || '—' },
  ]

  const notPerService = (v: Record<string, string>) => v.scheduleType !== 'per_service'
  const perService    = (v: Record<string, string>) => v.scheduleType === 'per_service'
  const hasPermit     = (v: Record<string, string>) => v.workPermit === 'true'

  const typeOptions = EMPLOYMENT_TYPES.map(v => ({ value: v, label: hrRoot.employmentTypes[v] }))
  const supervisorOptions = staff
    .filter(m => m.id !== member.id && m.status !== 'inactive')
    .map(m => ({ value: m.id, label: m.name }))

  const identityFields: Field[] = [
    { key: 'name', label: f.name, required: true },
    { key: 'profile.preferredName', label: f.preferredName },
    { key: 'dateOfBirth', label: f.dateOfBirth, type: 'date' },
    { key: 'immigrationStatus', label: f.immigrationStatus, type: 'select', options: IMMIGRATION_OPTIONS.map(o => ({ value: o, label: o })) },
    { key: 'taxIdType', label: f.taxIdType, type: 'select', options: [{ value: 'SSN', label: 'SSN' }, { value: 'ITIN', label: 'ITIN' }] },
    { key: 'taxId', label: f.taxId },
    { key: 'workPermit', label: f.workPermit, type: 'bool' },
    { key: 'workPermitExpiry', label: f.workPermitExpiry, type: 'date', showIf: hasPermit },
  ]
  const contactFields: Field[] = [
    { key: 'email', label: f.email, type: 'email', required: true },
    { key: 'phone', label: f.phone, type: 'tel' },
    { key: 'profile.personalEmail', label: f.personalEmail, type: 'email' },
    { key: 'profile.altPhone', label: f.altPhone, type: 'tel' },
  ]
  const emergencyFields: Field[] = [
    { key: 'emergencyContactName', label: f.emergencyName },
    { key: 'emergencyContactPhone', label: f.emergencyPhone, type: 'tel' },
  ]
  const addressFields: Field[] = [
    { key: 'profile.addressLine', label: f.addressLine, wide: true },
    { key: 'profile.city', label: f.city },
    { key: 'profile.state', label: f.state },
    { key: 'profile.zipCode', label: f.zipCode },
  ]
  const medicalFields: Field[] = [{ key: 'profile.medicalNotes', label: f.medicalNotes, type: 'textarea', wide: true }]
  const positionFields: Field[] = [
    { key: 'profile.jobTitle', label: f.jobTitle },
    { key: 'staffGroupId', label: f.group, type: 'group', display: m => m.staffGroup?.name || '—' },
    { key: 'profile.employmentType', label: f.employmentType, type: 'select', options: typeOptions },
    { key: 'profile.supervisorId', label: f.supervisor, type: 'select', options: supervisorOptions, display: () => supervisor },
    { key: 'profile.zone', label: f.zone },
    { key: 'hireDate', label: f.hireDate, type: 'date' },
    { key: 'profile.probationEndDate', label: f.probationEndDate, type: 'date' },
  ]
  const scheduleFields: Field[] = WEEK_DAYS.map(day => ({ key: `schedule.${day}`, label: hr.days[day] }))
  const fixedDays = (v: Record<string, string>) => v['schedule.rotating'] !== 'true'
  const patternFields: Field[] = [
    { key: 'schedule.rotating', label: f.rotating, type: 'bool', required: true, fallback: 'false' },
    { key: 'schedule.hoursPerDay', label: f.hoursPerDay, type: 'number', fallback: String(DEFAULT_PATTERN.hoursPerDay), showIf: fixedDays },
    { key: 'schedule.worksHolidays', label: f.worksHolidays, type: 'bool', required: true, fallback: 'false', showIf: fixedDays },
    ...WEEK_DAYS.map((day): Field => ({
      key: `schedule.work_${day}`, label: hr.days[day], type: 'bool', required: true,
      fallback: String(DEFAULT_PATTERN.workDays.includes(day)), showIf: fixedDays,
    })),
  ]
  const accountFields: Field[] = [
    { key: 'role', label: f.role, type: 'select', required: true, options: [{ value: 'admin', label: hr.roles.admin }, { value: 'user', label: hr.roles.user }] },
    { key: 'status', label: f.status, type: 'select', required: true, options: ['active', 'invited', 'inactive'].map(v => ({ value: v, label: (hrRoot.chips as Record<string, string>)[v] })) },
    { key: 'password', label: f.password, writeOnly: true, wide: true, hint: f.passwordHint },
  ]
  const payFields: Field[] = [
    { key: 'scheduleType', label: f.payType, type: 'select', options: PAY_FREQUENCIES.map(o => ({ value: o.value, label: o.label })) },
    { key: 'hourlyRate', label: f.payAmount, type: 'number', showIf: notPerService },
    { key: 'rate.per1BR', label: f.per1BR, type: 'number', showIf: perService },
    { key: 'rate.per2BR', label: f.per2BR, type: 'number', showIf: perService },
    { key: 'rate.per3BR', label: f.per3BR, type: 'number', showIf: perService },
    { key: 'rate.extraFee', label: f.extraFee, type: 'number', showIf: perService },
  ]
  const depositFields: Field[] = [
    { key: 'profile.bankName', label: f.bankName, wide: true },
    { key: 'profile.bankRouting', label: f.bankRouting },
    { key: 'profile.bankAccount', label: f.bankAccount },
  ]
  const hoursFields: Field[] = [
    { key: 'profile.vacationHours', label: f.vacationHours, type: 'number' },
    { key: 'profile.sickHours', label: f.sickHours, type: 'number' },
    { key: 'profile.personalHours', label: f.personalHours, type: 'number' },
  ]
  const noteFields: Field[] = [{ key: 'notes', label: f.notes, type: 'textarea', wide: true }]

  const keyData = [
    { label: f.employeeCode, value: p?.employeeCode || '—' },
    { label: f.jobTitle, value: p?.jobTitle || '—' },
    { label: f.group, value: member.staffGroup?.name || '—' },
    { label: f.employmentType, value: typeLabel || '—' },
    { label: f.supervisor, value: supervisor },
    { label: f.zone, value: p?.zone || '—' },
    { label: f.hireDate, value: fmtDate(member.hireDate) },
    { label: f.tenure, value: sinceText },
    { label: f.dateOfBirth, value: fmtDate(member.dateOfBirth) },
    { label: f.immigrationStatus, value: member.immigrationStatus || '—' },
    { label: f.taxId, value: member.taxId ? `${member.taxIdType || 'SSN'} ${member.taxId}` : '—' },
    { label: hrRoot.columns.rate, value: pay },
  ]

  const sectionProps = { member, onSaved }
  const tabLabels: Record<TabKey, string> = { ...hr.tabs, absences: t.staffAbsence.tabInFile, documents: t.staffDocs.tabInFile }
  const tabs: TabKey[] = ['summary', 'personal', 'employment', 'compensation', 'absences', 'documents', 'performance', 'equipment', 'notes']
  const docs = complianceOf(member, documents, today)
  const sr = t.staffRecords
  const stats = history?.stats
  const reviews = records.filter(r => r.kind === 'review')
  const reviewAvg = reviews.length ? reviews.reduce((s, r) => s + reviewAverage(r), 0) / reviews.length : null
  const returnedExtra = {
    label: sr.fields.endDate,
    render: (r: any) => r.endDate
      ? <span className="text-[#38d9a9]">{sr.returned}</span>
      : <span className="text-[#f59e0b]">{sr.outstanding}</span>,
  }
  const pendingCount = absences.filter(a => a.userId === member.id && a.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} aria-label={hr.back} title={hr.back} className="p-1.5 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all">
            <ChevronLeft size={15} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#e8eaf0]">{hr.title}</h1>
            <p className="text-xs text-[#6b7280] mt-0.5 truncate">{hr.breadcrumb(member.name)}{p?.employeeCode ? ` · ${p.employeeCode}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#6b7280] shrink-0">
          <button onClick={() => onSelect(staff[index - 1])} disabled={index <= 0} aria-label={hr.prev} title={hr.prev}
            className="p-1.5 rounded-lg border border-[#2a2f3d] hover:text-[#e8eaf0] disabled:opacity-40 transition-all">
            <ChevronLeft size={15} />
          </button>
          <span>{index + 1} / {staff.length}</span>
          <button onClick={() => onSelect(staff[index + 1])} disabled={index >= staff.length - 1} aria-label={hr.next} title={hr.next}
            className="p-1.5 rounded-lg border border-[#2a2f3d] hover:text-[#e8eaf0] disabled:opacity-40 transition-all">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className={`${CARD} p-5 flex flex-col md:flex-row gap-5`}>
        <div className="w-[74px] h-[74px] rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
          {initialsOf(member.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xl font-bold text-[#e8eaf0]">{member.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${statusColor}1f`, color: statusColor }}>{statusLabel}</span>
            {p?.employeeCode && <span className="font-mono text-[11px] text-[#4f8ef7]">{p.employeeCode}</span>}
          </div>
          {headline && <div className="text-xs text-[#6b7280] mt-1">{headline}</div>}
          <div className="mt-3 pt-3 border-t border-[#2a2f3d] grid grid-cols-2 lg:grid-cols-6 gap-3">
            {heroMeta.map(item => (
              <div key={item.label} className="min-w-0">
                <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider">{item.label}</div>
                <div className="text-xs font-semibold text-[#e8eaf0] truncate" title={item.value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 md:self-start bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-3 shrink-0"
          title={missing.map(k => hr.missingLabels[k]).join(', ')}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#4f8ef7 ${pct * 3.6}deg, #2a2f3d 0deg)` }}>
            <div className="w-8 h-8 rounded-full bg-[#1e2330] flex items-center justify-center text-[10px] font-bold text-[#e8eaf0]">{pct}%</div>
          </div>
          <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider max-w-20">{hr.fileComplete}</div>
        </div>
      </div>

      <div className="flex border-b border-[#2a2f3d] overflow-x-auto">
        {tabs.map(key => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
              tab === key ? 'border-[#4f8ef7] text-[#4f8ef7]' : 'border-transparent text-[#6b7280] hover:text-[#e8eaf0]'
            }`}>
            {tabLabels[key]}
            {key === 'documents' && member.status !== 'inactive' && docs.alerts > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(248,113,113,0.15)] text-[#f87171]">{docs.alerts}</span>
            )}
            {key === 'absences' && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Keyed by person so a half-finished edit never carries over to the next file. */}
      <div key={member.id}>
        {tab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${CARD} lg:col-span-2`}>
              <div className={CARD_HEAD}><span className={CARD_TITLE}>{hr.sections.keyData}</span></div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                {keyData.map(item => (
                  <div key={item.label}>
                    <div className="text-[10px] text-[#6b7280] mb-0.5">{item.label}</div>
                    <div className="text-xs text-[#e8eaf0] break-words">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className={CARD}>
                <div className={CARD_HEAD}><span className={CARD_TITLE}>{hr.sections.hours}</span></div>
                <div className="p-4 space-y-2">
                  {hoursFields.map(h => {
                    const value = readValue(member, h.key)
                    return (
                      <div key={h.key} className="flex items-center justify-between text-xs">
                        <span className="text-[#6b7280]">{h.label}</span>
                        <span className="font-semibold text-[#e8eaf0]">{value != null ? Number(value) : '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className={CARD}>
                <div className={CARD_HEAD}><span className={CARD_TITLE}>{hr.sections.attention}</span></div>
                <div className="p-4 space-y-2">
                  {permitDue && (
                    <div className="flex items-center gap-2 text-xs text-[#f59e0b]">
                      <AlertTriangle size={13} className="shrink-0" />{hr.permitAlert(fmtDate(member.workPermitExpiry))}
                    </div>
                  )}
                  {missing.map(k => (
                    <div key={k} className="text-xs text-[#6b7280]">{hr.missing(hr.missingLabels[k])}</div>
                  ))}
                  {member.status !== 'inactive' && docs.alerts > 0 && (
                    <button onClick={() => setTab('documents')} className="flex items-center gap-2 text-xs text-[#f87171] hover:underline">
                      <AlertTriangle size={13} className="shrink-0" />{t.staffDocs.attention(docs.alerts)}
                    </button>
                  )}
                  {!permitDue && missing.length === 0 && (member.status === 'inactive' || docs.alerts === 0) && <div className="text-xs text-[#38d9a9]">{hr.allGood}</div>}
                </div>
              </div>
              <div className={CARD}>
                <div className={CARD_HEAD}><span className={CARD_TITLE}>{hr.sections.emergency}</span></div>
                <div className="p-4 text-xs text-[#e8eaf0] space-y-1">
                  <div>{member.emergencyContactName || '—'}</div>
                  {member.emergencyContactPhone && (
                    <div className="flex items-center gap-1 text-[#6b7280]"><Phone size={10} />{member.emergencyContactPhone}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Section {...sectionProps} title={hr.sections.identity} fields={identityFields} />
            <div className="space-y-4">
              <Section {...sectionProps} title={hr.sections.contact} fields={contactFields} />
              <Section {...sectionProps} title={hr.sections.emergency} fields={emergencyFields} />
            </div>
            <Section {...sectionProps} title={hr.sections.address} fields={addressFields} />
            <Section {...sectionProps} title={hr.sections.medical} fields={medicalFields} />
          </div>
        )}

        {tab === 'employment' && (
          <div className="space-y-4">
            <Section {...sectionProps} title={hr.sections.position} fields={positionFields} columns={4} />
            <Section {...sectionProps} title={hr.sections.schedule} fields={scheduleFields} columns={7} />
            <Section {...sectionProps} title={hr.sections.workPattern} fields={patternFields} columns={4} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <Section {...sectionProps} title={hr.sections.account} fields={accountFields} />
              {member.role === 'user' && (
                <div className={CARD}>
                  <div className={CARD_HEAD}><span className={CARD_TITLE}>{hr.sections.calendar}</span></div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>{t.staffPage.calendarAccess}</label>
                      <select
                        value={member.scheduleVisibility || '1'}
                        disabled={visibilitySaving}
                        onChange={e => onVisibilityChange(member.id, e.target.value, 'future')}
                        className={`${INPUT} disabled:opacity-50`}
                      >
                        {SCHEDULE_VISIBILITY_OPTIONS.map(v => <option key={v} value={v}>{t.staffPage.scheduleVisibilityOptions[v]}</option>)}
                      </select>
                    </div>
                    {/* 'full' already shows the whole calendar in both
                        directions, so a past window would be a no-op. */}
                    {(member.scheduleVisibility || '1') !== 'full' && (
                      <div>
                        <label className={LABEL}>{t.staffPage.pastDaysAccess}</label>
                        <select
                          value={member.schedulePastVisibility || '0'}
                          disabled={visibilitySaving}
                          onChange={e => onVisibilityChange(member.id, e.target.value, 'past')}
                          className={`${INPUT} disabled:opacity-50`}
                        >
                          {SCHEDULE_PAST_OPTIONS.map(v => <option key={v} value={v}>{t.staffPage.schedulePastOptions[v]}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'compensation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Section {...sectionProps} title={hr.sections.pay} fields={payFields} />
            <div className="space-y-4">
              <Section {...sectionProps} title={hr.sections.hours} fields={hoursFields} />
              <Section {...sectionProps} title={hr.sections.deposit} fields={depositFields} />
            </div>
          </div>
        )}

        {tab === 'absences' && (
          <ProfileAbsences member={member} absences={absences} onOpen={onOpenAbsence} onRegister={onRegisterAbsence}
            records={records} onRecordsChanged={recordsChanged} />
        )}

        {tab === 'documents' && <ProfileDocuments member={member} documents={documents} onChanged={() => { onDocumentsChanged(); recordsChanged() }} />}

        {tab === 'performance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { label: sr.perf.completedYear, value: stats ? String(stats.completedYear) : '…' },
                { label: sr.perf.completed90,   value: stats ? String(stats.completed90) : '…' },
                { label: sr.perf.cancelledYear, value: stats ? String(stats.cancelledYear) : '…' },
                { label: sr.perf.lastService,   value: stats ? fmtDate(stats.lastService) : '…' },
                { label: sr.perf.nextService,   value: stats ? fmtDate(stats.nextService) : '…' },
                { label: sr.perf.reviewAverage, value: reviewAvg != null ? `${reviewAvg.toFixed(1)} / 5` : '—' },
              ].map(k => (
                <div key={k.label} className={`${CARD} p-3`}>
                  <div className="text-[10px] text-[#6b7280]">{k.label}</div>
                  <div className="text-base font-bold text-[#e8eaf0] mt-0.5">{k.value}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#6b7280]">{sr.perf.noRatings}</p>
            <RecordSection member={member} kind="review" records={records}
              columns={['date', 'quality', 'punctuality', 'teamwork', 'communication', 'comment']}
              extra={{ label: sr.average, render: r => reviewAverage(r).toFixed(1) }} onChanged={recordsChanged} />
            <RecordSection member={member} kind="training" records={records} columns={['name', 'date', 'endDate', 'note']} onChanged={recordsChanged} />
          </div>
        )}

        {tab === 'equipment' && (
          <div className="space-y-4">
            <RecordSection member={member} kind="equipment" records={records}
              columns={['category', 'name', 'identifier', 'date']} extra={returnedExtra} onChanged={recordsChanged} />
            <RecordSection member={member} kind="key" records={records}
              columns={['client', 'keyLabel', 'code', 'date']} extra={returnedExtra} onChanged={recordsChanged} />
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-4">
            <Section {...sectionProps} title={hr.sections.notes} fields={noteFields} />
            <RecordSection member={member} kind="note" records={records} columns={['visibility', 'body']}
              extra={{ label: sr.fields.date, render: r => `${fmtDate(r.createdAt)}${r.author ? ` · ${r.author.name}` : ''}` }}
              onChanged={recordsChanged} />
            <RecordSection member={member} kind="discipline" records={records} columns={['date', 'level', 'description']} onChanged={recordsChanged} />
            <ProfileHistory audit={history?.audit ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
