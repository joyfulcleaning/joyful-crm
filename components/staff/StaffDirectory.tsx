'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import {
  EMPLOYMENT_TYPES, STAFF_STATUS_COLORS,
  completeness, fmtDate, initialsOf, isOnProbation, payText, permitExpiringSoon, tenure,
} from '@/lib/staff-profile'
import { addDays, balances, coversDay, isActive } from '@/lib/staff-absence'
import { TypeLabel, absenceRange } from './absence-ui'
import { complianceOf } from '@/lib/staff-documents'

const SELECT = 'px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const TH = 'px-3 py-2.5 text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider whitespace-nowrap select-none'
const TD = 'px-3 py-2.5 text-xs text-[#e8eaf0] whitespace-nowrap'

type StatusChip = 'all' | 'active' | 'on_leave' | 'probation' | 'invited' | 'inactive'
type SortKey = 'name' | 'code' | 'job' | 'type' | 'phone' | 'supervisor' | 'hire' | 'rate' | 'status' | 'vacation' | 'file' | 'next'

interface Props {
  staff:    any[]
  absences: any[]
  documents: any[]
  onOpen:   (member: any) => void
  onOpenAbsence: (absence: any) => void
}

export default function StaffDirectory({ staff, absences, documents, onOpen, onOpenAbsence }: Props) {
  const { t } = useI18n()
  const hr    = t.staffHr
  const sa    = t.staffAbsence
  const today = localDateStr()

  const [query, setQuery]           = useState('')
  const [groupId, setGroupId]       = useState('')
  const [type, setType]             = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [chip, setChip]             = useState<StatusChip>('all')
  const [sort, setSort]             = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false })

  const nameById = useMemo(() => new Map(staff.map(m => [m.id, m.name as string])), [staff])
  const groups   = useMemo(() => {
    const map = new Map<string, string>()
    staff.forEach(m => { if (m.staffGroup) map.set(m.staffGroup.id, m.staffGroup.name) })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [staff])
  const supervisors = useMemo(() => {
    const ids = new Set(staff.map(m => m.hrProfile?.supervisorId).filter(Boolean))
    return Array.from(ids).map(id => ({ id, name: nameById.get(id) || '—' }))
  }, [staff, nameById])

  const chipLabels: Record<StatusChip, string> = { ...hr.chips, on_leave: sa.onLeave }

  const onLeaveToday = (m: any) =>
    absences.some(a => a.userId === m.id && a.status === 'approved' && coversDay(a, today))

  const matchesChip = (m: any, c: StatusChip) =>
    c === 'all' ? true : c === 'probation' ? isOnProbation(m, today) : c === 'on_leave' ? onLeaveToday(m) : m.status === c

  // The soonest active absence that hasn't ended yet.
  const nextAbsence = (m: any) => absences
    .filter(a => a.userId === m.id && isActive(a) && a.endDate.slice(0, 10) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  const vacationLeft = (m: any) => balances(m, absences, Number(today.slice(0, 4)))[0].available

  const stats = useMemo(() => ({
    active:     staff.filter(m => m.status === 'active').length,
    absent:     staff.filter(onLeaveToday),
    pending:    absences.filter(a => a.status === 'pending').length,
    docs: staff.filter(m => m.status !== 'inactive').map(m => complianceOf(m, documents, today))
      .reduce((s, c) => ({ expired: s.expired + c.expired, expiring: s.expiring + c.expiring, missing: s.missing + c.missing }),
              { expired: 0, expiring: 0, missing: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [staff, absences, documents, today])

  const sortValue = (m: any, key: SortKey): string | number => {
    switch (key) {
      case 'name':       return m.name.toLowerCase()
      case 'code':       return m.hrProfile?.employeeCode || ''
      case 'job':        return (m.hrProfile?.jobTitle || m.staffGroup?.name || '').toLowerCase()
      case 'type':       return m.hrProfile?.employmentType || ''
      case 'phone':      return m.phone || ''
      case 'supervisor': return (nameById.get(m.hrProfile?.supervisorId) || '').toLowerCase()
      case 'hire':       return m.hireDate?.slice(0, 10) || ''
      case 'rate':       return Number(m.hourlyRate) || 0
      case 'status':     return m.status
      case 'vacation':   return vacationLeft(m) ?? -1
      case 'next':       return nextAbsence(m)?.startDate.slice(0, 10) || '9999'
      case 'file':       return completeness(m)
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = staff.filter(m => {
      if (!matchesChip(m, chip)) return false
      if (groupId && m.staffGroupId !== groupId) return false
      if (type && m.hrProfile?.employmentType !== type) return false
      if (supervisorId && m.hrProfile?.supervisorId !== supervisorId) return false
      if (!q) return true
      const p = m.hrProfile
      return [m.name, m.email, m.phone, m.staffGroup?.name, p?.employeeCode, p?.jobTitle, p?.zone, p?.preferredName]
        .some(v => v?.toLowerCase().includes(q))
    })
    return filtered.sort((a, b) => {
      const av = sortValue(a, sort.key), bv = sortValue(b, sort.key)
      const cmp = typeof av === 'number' ? av - (bv as number) : av.localeCompare(bv as string)
      return sort.desc ? -cmp : cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, absences, query, groupId, type, supervisorId, chip, sort, today])

  const hasFilters = !!(query || groupId || type || supervisorId || chip !== 'all')

  function clearFilters() {
    setQuery(''); setGroupId(''); setType(''); setSupervisorId(''); setChip('all')
  }

  function toggleSort(key: SortKey) {
    setSort(s => ({ key, desc: s.key === key ? !s.desc : false }))
  }

  const statCards = [
    { label: hr.stats.active,     value: stats.active,     sub: hr.stats.activeOf(staff.length),            color: '#4f8ef7' },
    {
      label: sa.stats.absentToday,
      value: stats.absent.length,
      sub:   stats.absent.length ? stats.absent.map(m => m.name.split(' ')[0]).join(', ') : sa.stats.noneToday,
      color: '#a78bfa',
    },
    { label: sa.stats.pending,    value: stats.pending,    sub: sa.stats.pendingSub,                        color: '#f59e0b' },
    {
      label: t.staffDocs.alertsCard,
      value: stats.docs.expired + stats.docs.expiring + stats.docs.missing,
      sub:   t.staffDocs.alertsSub(stats.docs.expired, stats.docs.expiring, stats.docs.missing),
      color: '#f87171',
    },
  ]

  const columns: { key: SortKey; label: string }[] = [
    { key: 'name',       label: hr.columns.name },
    { key: 'code',       label: hr.columns.code },
    { key: 'job',        label: hr.columns.job },
    { key: 'type',       label: hr.columns.type },
    { key: 'phone',      label: hr.columns.phone },
    { key: 'supervisor', label: hr.columns.supervisor },
    { key: 'hire',       label: hr.columns.hire },
    { key: 'rate',       label: hr.columns.rate },
    { key: 'status',     label: hr.columns.status },
    { key: 'vacation',   label: hr.columns.vacation },
    { key: 'file',       label: hr.columns.file },
    { key: 'next',       label: sa.nextAbsence },
  ]

  // Monday to Sunday of the current week.
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const sunday = addDays(monday, 6)
  const pending = absences.filter(a => a.status === 'pending')
  // Dated documents and work permits running out within the alert window, or already out.
  const expirations = [
    ...staff.filter(m => m.status !== 'inactive').flatMap(m => complianceOf(m, documents, today).rows
      .filter(r => r.status === 'expiring' || r.status === 'expired')
      .map(r => ({ key: `${m.id}-${r.key}`, member: m, label: t.staffDocs.names[r.key], date: r.doc.expiresAt.slice(0, 10) }))),
    ...staff.filter(m => permitExpiringSoon(m, today))
      .map(m => ({ key: `${m.id}-permit`, member: m, label: t.staffHr.profile.fields.workPermit, date: m.workPermitExpiry.slice(0, 10) })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const outThisWeek = absences
    .filter(a => a.status === 'approved' && a.startDate.slice(0, 10) <= sunday && a.endDate.slice(0, 10) >= monday)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 border-t-2" style={{ borderTopColor: card.color }}>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
            <div className="text-2xl font-bold text-[#e8eaf0] mt-1">{card.value}</div>
            <div className="text-[10px] text-[#6b7280] mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between">
          <span className="text-sm font-bold text-[#e8eaf0]">{hr.directoryTitle}</span>
          <span className="text-[11px] text-[#6b7280]">{hr.countOf(rows.length, staff.length)}</span>
        </div>

        <div className="px-4 py-3 border-b border-[#2a2f3d] flex flex-wrap items-center gap-2">
          <div className="relative flex-[1_1_320px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={hr.searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
            />
          </div>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} className={SELECT}>
            <option value="">{hr.allGroups}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} className={SELECT}>
            <option value="">{hr.allTypes}</option>
            {EMPLOYMENT_TYPES.map(v => <option key={v} value={v}>{hr.employmentTypes[v]}</option>)}
          </select>
          <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className={SELECT}>
            <option value="">{hr.allSupervisors}</option>
            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[11px] font-semibold text-[#4f8ef7] hover:underline">
              {hr.clearFilters}
            </button>
          )}
        </div>

        <div className="px-4 py-2.5 border-b border-[#2a2f3d] flex flex-wrap gap-1.5">
          {(Object.keys(chipLabels) as StatusChip[]).map(c => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                chip === c
                  ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]'
                  : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
              }`}
            >
              {chipLabels[c]} · {staff.filter(m => matchesChip(m, c)).length}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2f3d]">
                {columns.map(col => (
                  <th key={col.key} className={TH}>
                    <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-[#e8eaf0]">
                      {col.label}
                      {sort.key === col.key && (sort.desc ? <ChevronDown size={11} className="text-[#4f8ef7]" /> : <ChevronUp size={11} className="text-[#4f8ef7]" />)}
                    </button>
                  </th>
                ))}
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {rows.map(m => {
                const p        = m.hrProfile
                const pct      = completeness(m)
                const pctColor = pct === 100 ? '#38d9a9' : pct >= 85 ? '#4f8ef7' : '#f87171'
                const leaving  = onLeaveToday(m)
                const statusKey = leaving ? 'on_leave' : isOnProbation(m, today) ? 'probation' : m.status
                const vacation = vacationLeft(m)
                const next     = nextAbsence(m)
                const statusColor = STAFF_STATUS_COLORS[statusKey] || '#6b7280'
                const since    = m.hireDate ? tenure(m.hireDate, today) : null
                return (
                  <tr
                    key={m.id}
                    onClick={() => onOpen(m)}
                    className="border-b border-[#1e2330] last:border-0 hover:bg-[rgba(79,142,247,0.05)] cursor-pointer transition-colors"
                  >
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
                          {initialsOf(m.name)}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold">{m.name}</div>
                          <div className="text-[11px] text-[#6b7280]">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} font-mono text-[11px] text-[#4f8ef7]`}>{p?.employeeCode || '—'}</td>
                    <td className={TD}>
                      <div>{p?.jobTitle || '—'}</div>
                      {m.staffGroup && <div className="text-[10px] font-bold" style={{ color: m.staffGroup.color || '#4f8ef7' }}>{m.staffGroup.name}</div>}
                    </td>
                    <td className={TD}>{hr.employmentTypes[p?.employmentType] || '—'}</td>
                    <td className={TD}>{m.phone || '—'}</td>
                    <td className={TD}>{nameById.get(p?.supervisorId) || '—'}</td>
                    <td className={TD}>
                      <div>{fmtDate(m.hireDate)}</div>
                      {since && <div className="text-[10px] text-[#6b7280]">{hr.tenure(since.years, since.months)}</div>}
                    </td>
                    <td className={`${TD} font-semibold text-[#38d9a9]`}>{payText(m, hr)}</td>
                    <td className={TD}>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${statusColor}1f`, color: statusColor }}>
                        {chipLabels[statusKey as StatusChip] || m.status}
                      </span>
                    </td>
                    <td className={TD}>{vacation != null ? hr.hoursShort(String(vacation)) : '—'}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#2a2f3d] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                        </div>
                        <span className="text-[11px] font-semibold" style={{ color: pctColor }}>{pct}%</span>
                      </div>
                    </td>
                    <td className={TD}>
                      {next ? (
                        <div>
                          <div>{absenceRange(next)}</div>
                          <div className="text-[10px] text-[#6b7280]"><TypeLabel type={next.type} /> · {sa.statuses[next.status]}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={TD}><ChevronRight size={14} className="text-[#6b7280]" /></td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-xs text-[#6b7280]">{hr.noResults}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2f3d] text-sm font-bold text-[#e8eaf0]">{sa.pendingTitle}</div>
          <div className="divide-y divide-[#1e2330]">
            {pending.map(a => (
              <button key={a.id} onClick={() => onOpenAbsence(a)} className="w-full text-left px-4 py-2.5 hover:bg-[rgba(79,142,247,0.05)] transition-colors">
                <div className="text-xs font-semibold text-[#e8eaf0]">{a.user?.name}</div>
                <div className="text-[11px] text-[#6b7280]"><TypeLabel type={a.type} /> · {absenceRange(a)}</div>
              </button>
            ))}
            {pending.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#6b7280]">{sa.pendingEmpty}</div>}
          </div>
        </div>
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2f3d] text-sm font-bold text-[#e8eaf0]">{sa.outThisWeek}</div>
          <div className="divide-y divide-[#1e2330]">
            {outThisWeek.map(a => (
              <button key={a.id} onClick={() => onOpenAbsence(a)} className="w-full text-left px-4 py-2.5 hover:bg-[rgba(79,142,247,0.05)] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#e8eaf0]">{a.user?.name}</span>
                  {coversDay(a, today) && <span className="text-[10px] font-bold text-[#4f8ef7]">{sa.today}</span>}
                </div>
                <div className="text-[11px] text-[#6b7280]"><TypeLabel type={a.type} /> · {absenceRange(a)}</div>
              </button>
            ))}
            {outThisWeek.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#6b7280]">{sa.outEmpty}</div>}
          </div>
        </div>
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2f3d] text-sm font-bold text-[#e8eaf0]">{t.staffDocs.upcoming}</div>
          <div className="divide-y divide-[#1e2330]">
            {expirations.map(e => (
              <button key={e.key} onClick={() => onOpen(e.member)} className="w-full text-left px-4 py-2.5 hover:bg-[rgba(79,142,247,0.05)] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#e8eaf0]">{e.member.name}</span>
                  <span className={`text-[10px] font-bold ${e.date < today ? 'text-[#f87171]' : 'text-[#f59e0b]'}`}>{fmtDate(e.date)}</span>
                </div>
                <div className="text-[11px] text-[#6b7280]">{e.label}</div>
              </button>
            ))}
            {expirations.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#6b7280]">{t.staffDocs.upcomingEmpty}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
