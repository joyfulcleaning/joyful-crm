'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import {
  ABSENCE_TYPES, BRADFORD_COLORS, addDays, balances, bradford, bradfordLevel,
  coversDay, eachDay, holidayOn, isActive, workPatternOf, workingDays,
} from '@/lib/staff-absence'
import { AbsenceTable } from './absence-ui'
import RecordSection from './RecordSection'

const CARD  = 'bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden'
const HEAD  = 'px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between gap-3'
const TITLE = 'text-sm font-bold text-[#e8eaf0]'
const SELECT = 'px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors'

const STRIPES = 'repeating-linear-gradient(45deg, transparent 0 2px, rgba(13,15,20,0.55) 2px 4px)'
const pad = (n: number) => String(n).padStart(2, '0')

interface Props {
  member:     any
  absences:   any[]
  onOpen:     (absence: any) => void
  onRegister: () => void
  records:    any[]
  onRecordsChanged: () => void
}

function MiniMonth({ year, month, label, mine, onOpen, today, weekdays }: {
  year: number; month: number; label: string; mine: any[]; onOpen: (a: any) => void; today: string; weekdays: string[]
}) {
  const last  = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days  = eachDay(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(last)}`)
  // Monday-first grid: how many blanks before the 1st.
  const blanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7

  return (
    <div>
      <div className="text-[11px] font-semibold text-[#e8eaf0] capitalize mb-1">{label}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekdays.map((w, i) => <div key={i} className="text-[8px] text-center text-[#6b7280]">{w}</div>)}
        {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
        {days.map(d => {
          const a = mine.find(x => coversDay(x, d))
          const holiday = !!holidayOn(d)
          return (
            <button
              key={d}
              disabled={!a}
              onClick={() => a && onOpen(a)}
              title={d}
              className={`aspect-square rounded-[3px] text-[8px] leading-none flex items-center justify-center ${a ? 'text-[#0d0f14] font-bold' : holiday ? 'text-[#6b7280] bg-[#252b3b]' : 'text-[#6b7280]'} ${d === today ? 'ring-1 ring-[#4f8ef7]' : ''}`}
              style={a ? { backgroundColor: ABSENCE_TYPES[a.type]?.color, backgroundImage: a.status === 'pending' ? STRIPES : undefined } : undefined}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ProfileAbsences({ member, absences, onOpen, onRegister, records, onRecordsChanged }: Props) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const today = localDateStr()
  const thisYear = Number(today.slice(0, 4))

  const [year, setYear]     = useState(thisYear)
  const [type, setType]     = useState('')
  const [status, setStatus] = useState('')

  const pattern = workPatternOf(member)
  const mine   = absences.filter(a => a.userId === member.id)
  const active = mine.filter(isActive)
  const shown  = mine.filter(a => (!type || a.type === type) && (!status || a.status === status))

  const approvedThisYear = mine.filter(a => a.status === 'approved' && Number(a.startDate.slice(0, 4)) === thisYear)
  const daysOut   = approvedThisYear.reduce((s, a) => s + workingDays(a.startDate, a.endDate, pattern), 0)
  const unplanned = approvedThisYear.filter(a => ABSENCE_TYPES[a.type]?.unplanned).length
  const score     = bradford(absences, member.id, today, pattern)
  const level     = bradfordLevel(score)

  const yearAgo = addDays(today, -365)
  const recentIncidents = records.filter(r => r.kind === 'incident' && (r.date?.slice(0, 10) ?? '') >= yearAgo)
  const incidentCount = (type: string) => recentIncidents.filter(r => r.data?.type === type).length

  const indicators = [
    { label: sa.daysOut,   value: String(daysOut),   color: '#e8eaf0' },
    { label: sa.unplanned, value: String(unplanned), color: '#e8eaf0' },
    { label: sa.bradford,  value: `${score} · ${sa.bradfordLevels[level]}`, color: BRADFORD_COLORS[level] },
    { label: t.staffRecords.lates,   value: String(incidentCount('late')),   color: '#e8eaf0' },
    { label: t.staffRecords.noShows, value: String(incidentCount('noshow')), color: incidentCount('noshow') ? '#f87171' : '#e8eaf0' },
  ]

  const monthLabel = (m: number) =>
    new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(t.locale, { month: 'long', timeZone: 'UTC' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={TITLE}>{sa.balanceTitle(thisYear)}</span>
        <button onClick={onRegister} className="flex items-center gap-2 px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-colors">
          <Plus size={13} />{sa.register}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {balances(member, absences, thisYear).map(b => {
          const total = b.granted ?? 0
          const usedPct = total ? Math.min((b.used / total) * 100, 100) : 0
          const pendPct = total ? Math.min((b.pending / total) * 100, 100 - usedPct) : 0
          return (
            <div key={b.bucket} className={`${CARD} p-4`}>
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{sa.buckets[b.bucket]}</div>
              {b.available === null ? (
                <div className="text-xs text-[#6b7280] mt-2">{sa.notSet}</div>
              ) : (
                <div className="mt-1">
                  <span className={`text-3xl font-bold ${b.available < 0 ? 'text-[#f87171]' : 'text-[#e8eaf0]'}`}>{b.available}</span>
                  <span className="text-[11px] text-[#6b7280] ml-1.5">{sa.availableHours}</span>
                </div>
              )}
              <div className="h-1.5 rounded-full bg-[#2a2f3d] overflow-hidden flex mt-2.5">
                <div className="h-full bg-[#4f8ef7]" style={{ width: `${usedPct}%` }} />
                <div className="h-full bg-[#f59e0b]" style={{ width: `${pendPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#6b7280] mt-1.5">
                <span>{sa.usedLabel} {b.used}</span>
                <span>{sa.pendingLabel} {b.pending}</span>
                <span>{sa.grantedLabel} {b.granted ?? '—'}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indicators.map(i => (
          <div key={i.label} className={`${CARD} p-3`}>
            <div className="text-[10px] text-[#6b7280]">{i.label}</div>
            <div className="text-base font-bold mt-0.5" style={{ color: i.color }}>{i.value}</div>
          </div>
        ))}
      </div>

      <div className={CARD}>
        <div className={HEAD}>
          <span className={TITLE}>{sa.yearCalendar}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} aria-label={String(year - 1)} className="p-1.5 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all"><ChevronLeft size={14} /></button>
            <span className="text-xs font-semibold text-[#e8eaf0] w-10 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} aria-label={String(year + 1)} className="p-1.5 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <MiniMonth key={m} year={year} month={m} label={monthLabel(m)} mine={active} onOpen={onOpen} today={today} weekdays={sa.weekdays} />
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>
          <span className={TITLE}>{sa.history}</span>
          <div className="flex items-center gap-2">
            <select value={type} onChange={e => setType(e.target.value)} className={SELECT}>
              <option value="">{sa.allTypes}</option>
              {Object.keys(ABSENCE_TYPES).map(k => <option key={k} value={k}>{sa.types[k]}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className={SELECT}>
              <option value="">{sa.allStatuses}</option>
              {Object.keys(sa.statuses).map(k => <option key={k} value={k}>{sa.statuses[k]}</option>)}
            </select>
          </div>
        </div>
        <AbsenceTable rows={shown} onOpen={onOpen} />
      </div>

      <RecordSection member={member} kind="incident" records={records}
        columns={['date', 'type', 'minutes', 'serviceNumber', 'justified', 'note']} onChanged={onRecordsChanged} />
    </div>
  )
}
