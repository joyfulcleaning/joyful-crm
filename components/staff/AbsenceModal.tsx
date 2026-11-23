'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { TimeSelect } from './absence-ui'
import { localDateStr } from '@/lib/local-date'
import { ABSENCE_TYPES, REASON_REQUIRED, absenceHours, balances, findOverlap, hoursBetween, parseHours, parseTime, workPatternOf, workingDays } from '@/lib/staff-absence'

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'

interface Props {
  staff:     any[]
  absences:  any[]
  // Set when opened from someone's file: the person is then fixed.
  member?:   any
  onClose:   () => void
  onSaved:   () => void
}

export default function AbsenceModal({ staff, absences, member, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const m  = sa.modal
  const today = localDateStr()

  const [userId, setUserId]   = useState<string>(member?.id ?? '')
  const [type, setType]       = useState('vacation')
  const [partial, setPartial] = useState(false)
  const [from, setFrom]       = useState(today)
  const [to, setTo]           = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime]     = useState('13:00')
  const [manualHours, setManualHours] = useState('')
  const [reason, setReason]   = useState('')
  const [status, setStatus]   = useState<'pending' | 'approved'>('pending')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const end        = partial ? from : to
  const person     = staff.find(s => s.id === userId)
  const badRange   = !!from && !!end && end < from
  const validTimes = !!parseTime(startTime) && !!parseTime(endTime) && startTime !== endTime
  const partialNum = partial && validTimes ? hoursBetween(startTime, endTime) : null
  const badHours   = partial && !validTimes
  const overlap    = !!userId && !!from && !!end && !badRange && !!findOverlap(absences, userId, from, end)
  const pattern    = workPatternOf(person)
  const noRange    = !from || !end || badRange
  const suggested  = noRange ? 0 : partial ? (partialNum || 0) : absenceHours(from, end, null, pattern)
  const manual     = parseHours(manualHours)
  const total      = manual ?? suggested
  const days       = noRange ? 0 : workingDays(from, end, pattern)

  const bucket  = ABSENCE_TYPES[type]?.bucket
  const balance = bucket && person && from
    ? balances(person, absences, Number(from.slice(0, 4))).find(b => b.bucket === bucket)
    : null
  const after = balance?.available != null ? balance.available - total : null

  async function save() {
    if (!userId || !from || !end) { setError(m.required); return }
    if (badRange) { setError(m.badRange); return }
    if (badHours) { setError(m.badHours); return }
    if (overlap)  { setError(m.overlap); return }
    if (REASON_REQUIRED.has(type) && !reason.trim()) { setError(m.reasonRequired); return }
    if (manualHours !== '' && manual === null) { setError(m.badHours); return }

    setSaving(true); setError('')
    try {
      const res = await fetch('/api/staff-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, type, status, reason,
          startDate: from,
          endDate: end,
          startTime: partial ? startTime : null,
          endTime:   partial ? endTime : null,
          totalHours: manual,
        }),
      })
      if (res.status === 409) { setError(m.overlap); return }
      if (!res.ok) throw new Error()
      onSaved()
    } catch {
      setError(m.saveError)
    } finally {
      setSaving(false)
    }
  }

  const segment = (active: boolean) =>
    `flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
      active ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]' : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
          <div className="text-sm font-bold text-[#e8eaf0]">{m.title}</div>
          <button onClick={onClose} aria-label={sa.drawer.close} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{m.person}</label>
              <select value={userId} disabled={!!member} onChange={e => setUserId(e.target.value)} className={`${INPUT} disabled:opacity-60`}>
                <option value="">{m.choose}</option>
                {staff.filter(s => s.status !== 'inactive').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>{m.type}</label>
              <select value={type} onChange={e => setType(e.target.value)} className={INPUT}>
                {Object.keys(ABSENCE_TYPES).map(k => <option key={k} value={k}>{sa.types[k]}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPartial(false)} className={segment(!partial)}>{m.fullDays}</button>
            <button type="button" onClick={() => setPartial(true)} className={segment(partial)}>{m.partialDay}</button>
          </div>

          {partial ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>{m.date}</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>{m.startTime}</label>
                <TimeSelect value={startTime} onChange={setStartTime} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>{m.endTime}</label>
                <TimeSelect value={endTime} onChange={setEndTime} className={INPUT} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>{m.from}</label>
                <input type="date" value={from} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>{m.to}</label>
                <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={INPUT} />
              </div>
            </div>
          )}

          <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-3 space-y-1 text-xs">
            {!partial && !pattern.rotating && (
              <div className="flex justify-between"><span className="text-[#6b7280]">{m.working}</span><span className="font-semibold text-[#e8eaf0]">{days}</span></div>
            )}
            <div className="flex justify-between"><span className="text-[#6b7280]">{m.total}</span><span className="font-semibold text-[#e8eaf0]">{total}</span></div>
            {partial && validTimes && endTime < startTime && <div className="text-[#6b7280]">{m.overnight}</div>}
            {!bucket && <div className="text-[#6b7280]">{m.noBalance}</div>}
            {bucket && balance?.available != null && (
              <div className={after! < 0 ? 'text-[#f87171] font-semibold' : 'text-[#e8eaf0]'}>{m.balanceFlow(balance.available, after!)}</div>
            )}
            {bucket && person && balance?.available == null && <div className="text-[#6b7280]">{sa.notSet}</div>}
            {after != null && after < 0 && <div className="text-[#f87171]">{m.negative}</div>}
            {!partial && !badRange && from && !pattern.rotating && days === 0 && <div className="text-[#f59e0b]">{m.offDays}</div>}
            {!partial && pattern.rotating && <div className="text-[#f59e0b]">{m.rotatingHint}</div>}
            {overlap && <div className="text-[#f87171] font-semibold">{m.overlap}</div>}
          </div>

          <div>
            <label className={LABEL}>{m.hoursToDeduct}</label>
            <input type="number" min="0" step="0.5" value={manualHours} placeholder={String(suggested)}
              onChange={e => setManualHours(e.target.value)} className={INPUT} />
          </div>

          <div>
            <label className={LABEL}>{m.reason}</label>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className={`${INPUT} resize-none`} />
          </div>

          <div>
            <label className={LABEL}>{m.initialStatus}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatus('pending')} className={segment(status === 'pending')}>{m.sendForApproval}</button>
              <button type="button" onClick={() => setStatus('approved')} className={segment(status === 'approved')}>{m.logApproved}</button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#161922] border-t border-[#2a2f3d] px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
            {t.staffHr.profile.cancel}
          </button>
          <button onClick={save} disabled={saving || overlap} className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
            <Plus size={13} />{saving ? m.saving : m.save}
          </button>
        </div>
      </div>
    </div>
  )
}
