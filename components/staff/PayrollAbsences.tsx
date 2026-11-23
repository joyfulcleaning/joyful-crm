'use client'

import { useI18n } from '@/lib/i18n'
import { StatusBadge, TypeLabel, absenceRange } from './absence-ui'
import { timeRangeText } from '@/lib/staff-absence'

interface Props {
  absences: any[]
  disabled: boolean
  onOpen:   (absenceId: string) => void
  // Appends a summary of the time off to the payment's notes, for the record.
  onNote:   (text: string) => void
}

// Time off inside the pay period, shown under the person's pay so the admin
// can decide whether to adjust it. It never changes the amount by itself.
export default function PayrollAbsences({ absences, disabled, onOpen, onNote }: Props) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const p  = sa.payroll
  if (absences.length === 0) return null

  const hoursOf = (a: any) => Math.round(Number(a.hoursInPeriod) * 100) / 100
  const total = absences.filter(a => a.status === 'approved').reduce((s, a) => s + hoursOf(a), 0)
  const summary = absences
    .map(a => `${sa.types[a.type] || a.type} ${absenceRange(a)}${timeRangeText(a) ? ` ${timeRangeText(a)}` : ''} (${hoursOf(a)} h${a.status === 'pending' ? `, ${sa.statuses.pending.toLowerCase()}` : ''})`)
    .join('; ')

  return (
    <div className="px-5 pb-3">
      <div className="rounded-lg border border-[rgba(79,142,247,0.25)] bg-[rgba(79,142,247,0.05)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-[#4f8ef7] uppercase tracking-wider">
            🏖 {p.title}{total > 0 ? ` · ${p.approvedHours(Math.round(total * 100) / 100)}` : ''}
          </span>
          <button type="button" disabled={disabled} onClick={() => onNote(`${p.notePrefix}: ${summary}`)}
            className="text-[10px] font-semibold text-[#4f8ef7] hover:underline disabled:opacity-40 disabled:no-underline">
            {p.addToNotes}
          </button>
        </div>
        <div className="mt-1.5 space-y-1">
          {absences.map(a => (
            <button key={a.id} type="button" onClick={() => onOpen(a.id)}
              className="w-full flex items-center gap-2 flex-wrap text-left text-[11px] text-[#e8eaf0] hover:text-[#4f8ef7] transition-colors">
              <TypeLabel type={a.type} />
              <span className="text-[#9ca3af]">{absenceRange(a)}{timeRangeText(a) ? ` · ${timeRangeText(a)}` : ''}</span>
              <span className="font-semibold">{sa.hours(hoursOf(a))}</span>
              <span className="text-[10px] text-[#6b7280]">
                {a.bucket ? p.usesBalance(sa.buckets[a.bucket]) : a.type === 'unpaid' ? p.unpaid : p.noBalance}
              </span>
              {a.status === 'pending' && <StatusBadge status="pending" />}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#6b7280] mt-1.5">{p.hint}</p>
      </div>
    </div>
  )
}
