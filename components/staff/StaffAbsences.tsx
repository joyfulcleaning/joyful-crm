'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import { ABSENCE_TYPES, coversDay, eachDay, holidayOn, isActive, isWeekend } from '@/lib/staff-absence'
import { AbsenceTable, TypeLabel, absenceRange } from './absence-ui'

const CARD  = 'bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden'
const HEAD  = 'px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between gap-3'
const TITLE = 'text-sm font-bold text-[#e8eaf0]'
const SELECT = 'px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors'

const STRIPES = 'repeating-linear-gradient(45deg, transparent 0 3px, rgba(13,15,20,0.55) 3px 6px)'

interface Props {
  staff:    any[]
  absences: any[]
  onOpen:   (absence: any) => void
}

export default function StaffAbsences({ staff, absences, onOpen }: Props) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const today = localDateStr()

  const [month, setMonth]   = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const [query, setQuery]   = useState('')
  const [type, setType]     = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear]     = useState('')

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate()
  const days = eachDay(`${month.y}-${pad(month.m)}-01`, `${month.y}-${pad(month.m)}-${pad(lastDay)}`)
  const monthLabel = new Date(Date.UTC(month.y, month.m - 1, 1))
    .toLocaleDateString(t.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  function shiftMonth(delta: number) {
    setMonth(({ y, m }) => {
      const total = y * 12 + (m - 1) + delta
      return { y: Math.floor(total / 12), m: (total % 12) + 1 }
    })
  }

  const active = useMemo(() => absences.filter(isActive), [absences])
  const people = staff.filter(s => s.status !== 'inactive')
  const pending = absences.filter(a => a.status === 'pending')

  const years = useMemo(
    () => Array.from(new Set(absences.map(a => a.startDate.slice(0, 4)))).sort().reverse() as string[],
    [absences],
  )

  const logRows = absences.filter(a => {
    if (type && a.type !== type) return false
    if (status && a.status !== status) return false
    if (year && a.startDate.slice(0, 4) !== year) return false
    return !query.trim() || a.user?.name.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className={`${CARD} border-[rgba(245,158,11,0.4)]`}>
          <div className={HEAD}><span className={TITLE}>{sa.pendingTitle} · {pending.length}</span></div>
          <div className="divide-y divide-[#1e2330]">
            {pending.map(a => (
              <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#e8eaf0] truncate">{a.user?.name}</div>
                  <div className="text-[11px] text-[#6b7280]"><TypeLabel type={a.type} /> · {absenceRange(a)}</div>
                </div>
                <button onClick={() => onOpen(a)} className="px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all shrink-0">
                  {sa.review}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className={HEAD}>
          <span className={TITLE}>{sa.teamCalendar}</span>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[10px] text-[#6b7280]">{sa.legendPending} · {sa.legendRisk}</span>
            <button onClick={() => shiftMonth(-1)} aria-label="-1" className="p-1.5 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all"><ChevronLeft size={14} /></button>
            <span className="text-xs font-semibold text-[#e8eaf0] capitalize w-32 text-center">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} aria-label="+1" className="p-1.5 rounded-lg border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#161922] z-10 min-w-40" />
                {days.map(d => {
                  const out = active.filter(a => coversDay(a, d)).length
                  const off = isWeekend(d) || !!holidayOn(d)
                  const holiday = holidayOn(d)
                  return (
                    <th key={d} title={holiday ? sa.holidays[holiday] : undefined}
                      className={`relative min-w-6 py-1.5 text-[10px] font-semibold ${d === today ? 'text-[#4f8ef7]' : off ? 'text-[#4b5263]' : 'text-[#6b7280]'}`}>
                      {Number(d.slice(8))}
                      {out >= 2 && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-[#f87171]" />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id} className="border-t border-[#1e2330]">
                  <td className="sticky left-0 bg-[#161922] z-10 px-3 py-1.5 text-xs text-[#e8eaf0] whitespace-nowrap">{person.name}</td>
                  {days.map(d => {
                    const a = active.find(x => x.userId === person.id && coversDay(x, d))
                    const off = isWeekend(d) || !!holidayOn(d)
                    return (
                      <td key={d} className={`p-0 h-7 ${off ? 'bg-[rgba(255,255,255,0.025)]' : ''}`}>
                        {a && (
                          <button
                            onClick={() => onOpen(a)}
                            title={`${sa.types[a.type]} · ${absenceRange(a)}`}
                            className="block w-full h-4 opacity-90 hover:opacity-100"
                            style={{
                              backgroundColor: ABSENCE_TYPES[a.type]?.color,
                              backgroundImage: a.status === 'pending' ? STRIPES : undefined,
                            }}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}><span className={TITLE}>{sa.log}</span></div>
        <div className="px-4 py-3 border-b border-[#2a2f3d] flex flex-wrap items-center gap-2">
          <div className="relative flex-[1_1_240px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={sa.search}
              className="w-full pl-8 pr-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
          </div>
          <select value={type} onChange={e => setType(e.target.value)} className={SELECT}>
            <option value="">{sa.allTypes}</option>
            {Object.keys(ABSENCE_TYPES).map(k => <option key={k} value={k}>{sa.types[k]}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={SELECT}>
            <option value="">{sa.allStatuses}</option>
            {Object.keys(sa.statuses).map(k => <option key={k} value={k}>{sa.statuses[k]}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)} className={SELECT}>
            <option value="">{sa.allYears}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <AbsenceTable rows={logRows} showPerson onOpen={onOpen} />
      </div>
    </div>
  )
}
