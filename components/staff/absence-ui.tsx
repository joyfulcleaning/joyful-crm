'use client'

import { useI18n } from '@/lib/i18n'
import { fmtDate } from '@/lib/staff-profile'
import { ABSENCE_STATUS_COLORS, ABSENCE_TYPES, timeRangeText } from '@/lib/staff-absence'

const TH = 'px-3 py-2.5 text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider whitespace-nowrap'
const TD = 'px-3 py-2.5 text-xs text-[#e8eaf0] whitespace-nowrap'

export function absenceRange(a: any) {
  const from = a.startDate.slice(0, 10), to = a.endDate.slice(0, 10)
  return from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const color = ABSENCE_STATUS_COLORS[status] || '#6b7280'
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ backgroundColor: `${color}1f`, color }}>
      {t.staffAbsence.statuses[status] || status}
    </span>
  )
}

export function TypeLabel({ type }: { type: string }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ABSENCE_TYPES[type]?.color || '#6b7280' }} />
      {t.staffAbsence.types[type] || type}
    </span>
  )
}

export function durationText(a: any, sa: { partial: (h: number) => string; hours: (h: number) => string }) {
  const range = timeRangeText(a)
  if (range) return `${range} · ${sa.hours(Number(a.totalHours))}`
  return a.partialHours ? sa.partial(Number(a.totalHours)) : sa.hours(Number(a.totalHours))
}

interface TableProps {
  rows:        any[]
  showPerson?: boolean
  onOpen:      (absence: any) => void
}

export function AbsenceTable({ rows, showPerson, onOpen }: TableProps) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const cols = [
    ...(showPerson ? [sa.columns.person] : []),
    sa.columns.type, sa.columns.dates, sa.columns.duration, sa.columns.status, sa.columns.requested, sa.columns.reviewedBy,
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2f3d]">{cols.map(c => <th key={c} className={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id} onClick={() => onOpen(a)} className="border-b border-[#1e2330] last:border-0 hover:bg-[rgba(79,142,247,0.05)] cursor-pointer transition-colors">
              {showPerson && <td className={`${TD} font-semibold`}>{a.user?.name}</td>}
              <td className={TD}><TypeLabel type={a.type} /></td>
              <td className={TD}>{absenceRange(a)}</td>
              <td className={TD}>{durationText(a, sa)}</td>
              <td className={TD}><StatusBadge status={a.status} /></td>
              <td className={TD}>{fmtDate(a.createdAt)}</td>
              <td className={TD}>{a.reviewedBy?.name || '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-xs text-[#6b7280]">{sa.empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
