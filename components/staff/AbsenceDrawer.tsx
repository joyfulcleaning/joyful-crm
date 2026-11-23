'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fmtDate } from '@/lib/staff-profile'
import {
  ABSENCE_TYPES, absenceHours, balances, hoursBetween, parseHours, parseTime, workPatternOf,
} from '@/lib/staff-absence'
import { StatusBadge, TypeLabel, absenceRange, durationText } from './absence-ui'

const HEADING = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5'
const INPUT = 'w-full px-3 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'

type EditForm = {
  type: string; partial: boolean; from: string; to: string
  startTime: string; endTime: string; hours: string; reason: string
}

function formOf(a: any): EditForm {
  return {
    type:      a.type,
    partial:   !!a.partialHours || !!a.startTime,
    from:      a.startDate.slice(0, 10),
    to:        a.endDate.slice(0, 10),
    startTime: a.startTime ?? '',
    endTime:   a.endTime ?? '',
    hours:     String(Number(a.totalHours)),
    reason:    a.reason ?? '',
  }
}

interface Props {
  absenceId: string
  staff:     any[]
  absences:  any[]
  onClose:   () => void
  // Fires after anything that changes absences or assignments.
  onChanged: () => void
  onOpenMember: (member: any) => void
}

export default function AbsenceDrawer({ absenceId, staff, absences, onClose, onChanged, onOpenMember }: Props) {
  const { t } = useI18n()
  const sa = t.staffAbsence
  const d  = sa.drawer

  const [detail, setDetail]   = useState<any>(null)
  const [error, setError]     = useState('')
  const [note, setNote]       = useState('')
  const [form, setForm]       = useState<EditForm | null>(null)
  const [busy, setBusy]       = useState(false)
  const [picks, setPicks]     = useState<Record<string, string>>({})
  const [covered, setCovered] = useState<Set<string>>(new Set())

  async function load() {
    try {
      const res = await fetch(`/api/staff-absences/${absenceId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDetail(data)
      setError('')
    } catch {
      setError(d.loadError)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [absenceId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function act(action: 'approve' | 'reject' | 'cancel') {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/staff-absences/${absenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      if (!res.ok) throw new Error()
      onChanged()
      await load()
    } catch {
      setError(d.actionError)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!form || !editCheck) return
    if (editCheck.error) { setError(editCheck.error); return }
    setBusy(true); setError('')
    try {
      const timed = form.partial && editCheck.timed
      const res = await fetch(`/api/staff-absences/${absenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'edit',
          type:      form.type,
          startDate: form.from,
          endDate:   form.partial ? form.from : form.to,
          startTime: timed ? form.startTime : null,
          endTime:   timed ? form.endTime : null,
          // A partial day logged before times existed keeps its hours.
          partialHours: form.partial && !timed ? Number(detail.partialHours) : null,
          totalHours: form.hours,
          reason:    form.reason,
        }),
      })
      if (res.status === 409) { setError(d.edit.overlap); return }
      if (!res.ok) throw new Error()
      setForm(null)
      onChanged()
      await load()
    } catch {
      setError(d.actionError)
    } finally {
      setBusy(false)
    }
  }

  async function assign(serviceId: string) {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/staff-absences/${absenceId}/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, replacementUserId: picks[serviceId] }),
      })
      if (!res.ok) throw new Error()
      setCovered(prev => new Set(prev).add(serviceId))
      onChanged()
    } catch {
      setError(d.actionError)
    } finally {
      setBusy(false)
    }
  }

  const member = detail && staff.find(s => s.id === detail.userId)
  const bucket = detail && ABSENCE_TYPES[detail.type]?.bucket
  const balance = bucket && member
    ? balances(member, absences, Number(detail.startDate.slice(0, 4))).find(b => b.bucket === bucket)
    : null
  const holdsTime = detail?.status === 'pending' || detail?.status === 'approved'

  // What the edited dates and times would spend, so the hours follow them
  // unless the admin types their own.
  const editCheck = (() => {
    if (!form || !detail) return null
    const end = form.partial ? form.from : form.to
    const timed = !!parseTime(form.startTime) && !!parseTime(form.endTime)
    let error = ''
    if (!form.from || !end) error = sa.modal.required
    else if (end < form.from) error = sa.modal.badRange
    else if (form.partial && timed && form.startTime === form.endTime) error = sa.modal.badHours
    else if (form.partial && !timed && !detail.partialHours) error = sa.modal.badHours
    else if (parseHours(form.hours) === null) error = sa.modal.badHours
    const partialHours = form.partial ? (timed && !error ? hoursBetween(form.startTime, form.endTime) : Number(detail.partialHours) || 0) : null
    const suggested = error && !partialHours ? 0 : absenceHours(form.from, end, partialHours, workPatternOf(member))
    return { error, timed, suggested, overnight: form.partial && timed && form.endTime < form.startTime }
  })()

  // Changing the dates or times moves the hours with them.
  function patchForm(patch: Partial<EditForm>) {
    setForm(f => {
      if (!f) return f
      const next = { ...f, ...patch }
      if (!('hours' in patch)) {
        const end = next.partial ? next.from : next.to
        const timed = !!parseTime(next.startTime) && !!parseTime(next.endTime) && next.startTime !== next.endTime
        const partialHours = next.partial ? (timed ? hoursBetween(next.startTime, next.endTime) : Number(detail.partialHours) || 0) : null
        if (next.from && end && end >= next.from) next.hours = String(absenceHours(next.from, end, partialHours, workPatternOf(member)))
      }
      return next
    })
  }

  const original = detail?.originalRequest

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[470px] bg-[#161922] border-l border-[#2a2f3d] flex flex-col shadow-[-24px_0_60px_rgba(0,0,0,0.5)]">
        <div className="px-5 py-4 border-b border-[#2a2f3d] flex items-center justify-between">
          <span className="text-sm font-bold text-[#e8eaf0]">{d.detail}</span>
          <button onClick={onClose} aria-label={d.close} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>
          )}
          {!detail && !error && <div className="text-center py-10 text-[#6b7280]"><Loader2 size={18} className="animate-spin inline" /></div>}

          {detail && (
            <>
              <div>
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[#e8eaf0]">
                  <TypeLabel type={detail.type} />
                  <StatusBadge status={detail.status} />
                </div>
                <div className="text-xs text-[#e8eaf0] mt-1.5">{absenceRange(detail)}</div>
                <div className="text-[11px] text-[#6b7280] mt-0.5">{durationText(detail, sa)}</div>
                {member
                  ? <button onClick={() => onOpenMember(member)} className="text-xs font-semibold text-[#4f8ef7] hover:underline mt-2">{detail.user.name}</button>
                  : <div className="text-xs font-semibold text-[#e8eaf0] mt-2">{detail.user.name}</div>}
                <div className="text-[11px] text-[#6b7280] mt-0.5">{d.requestedOn(fmtDate(detail.createdAt))}</div>
                {detail.reviewedBy && detail.reviewedAt && (
                  <div className="text-[11px] text-[#6b7280]">{d.reviewedOn(detail.reviewedBy.name, fmtDate(detail.reviewedAt))}</div>
                )}
              </div>

              {original && (
                <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-lg p-3">
                  <div className={HEADING}>{d.edit.originalTitle}</div>
                  <div className="text-xs text-[#e8eaf0]">
                    <TypeLabel type={original.type} /> · {absenceRange(original)}
                  </div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">{durationText(original, sa)}</div>
                </div>
              )}

              {holdsTime && !form && (
                <div>
                  <button onClick={() => setForm(formOf(detail))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-[11px] font-semibold text-[#4f8ef7] hover:border-[#4f8ef7] transition-all">
                    <Pencil size={12} />{d.edit.button}
                  </button>
                  <p className="text-[11px] text-[#6b7280] mt-1.5">{d.edit.hint}</p>
                  {Number(detail.totalHours) === 0 && <p className="text-[11px] text-[#f59e0b] mt-1.5">{d.zeroHours}</p>}
                </div>
              )}

              {holdsTime && form && editCheck && (
                <div className="bg-[#1e2330] border border-[#4f8ef7]/40 rounded-xl p-3 space-y-3">
                  <div className={HEADING}>{d.edit.title}</div>
                  <div>
                    <label className={HEADING}>{sa.modal.type}</label>
                    <select value={form.type} onChange={e => patchForm({ type: e.target.value })} className={INPUT}>
                      {Object.keys(ABSENCE_TYPES).map(k => <option key={k} value={k}>{sa.types[k]}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {([[false, sa.modal.fullDays], [true, sa.modal.partialDay]] as const).map(([p, label]) => (
                      <button key={String(p)} type="button" onClick={() => patchForm({ partial: p })}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          form.partial === p ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.partial ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={HEADING}>{sa.modal.date}</label>
                        <input type="date" value={form.from} onChange={e => patchForm({ from: e.target.value })} className={INPUT} />
                      </div>
                      <div>
                        <label className={HEADING}>{sa.modal.startTime}</label>
                        <input type="time" value={form.startTime} onChange={e => patchForm({ startTime: e.target.value })} className={INPUT} />
                      </div>
                      <div>
                        <label className={HEADING}>{sa.modal.endTime}</label>
                        <input type="time" value={form.endTime} onChange={e => patchForm({ endTime: e.target.value })} className={INPUT} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={HEADING}>{sa.modal.from}</label>
                        <input type="date" value={form.from} onChange={e => patchForm({ from: e.target.value, ...(form.to < e.target.value ? { to: e.target.value } : {}) })} className={INPUT} />
                      </div>
                      <div>
                        <label className={HEADING}>{sa.modal.to}</label>
                        <input type="date" value={form.to} min={form.from} onChange={e => patchForm({ to: e.target.value })} className={INPUT} />
                      </div>
                    </div>
                  )}
                  {editCheck.overnight && <p className="text-[11px] text-[#6b7280]">{sa.modal.overnight}</p>}
                  {form.partial && !editCheck.timed && !!detail.partialHours && (
                    <p className="text-[11px] text-[#6b7280]">{d.edit.noTimes}</p>
                  )}
                  <div>
                    <label className={HEADING}>{d.hoursToDeduct}</label>
                    <input type="number" min="0" step="0.25" value={form.hours} onChange={e => patchForm({ hours: e.target.value })} className={INPUT} />
                    {parseHours(form.hours) !== editCheck.suggested && (
                      <p className="text-[11px] text-[#6b7280] mt-1">{d.edit.suggested(editCheck.suggested)}</p>
                    )}
                  </div>
                  <div>
                    <label className={HEADING}>{d.reason}</label>
                    <textarea rows={2} value={form.reason} onChange={e => patchForm({ reason: e.target.value, hours: form.hours })} className={`${INPUT} resize-none`} />
                  </div>
                  {editCheck.error && <p className="text-[11px] text-[#f87171]">{editCheck.error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setForm(null)} className="px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-[11px] font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
                      {t.staffHr.profile.cancel}
                    </button>
                    <button onClick={saveEdit} disabled={busy || !!editCheck.error} className="px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-[11px] font-semibold rounded-lg transition-all disabled:opacity-40">
                      {d.edit.save}
                    </button>
                  </div>
                </div>
              )}

              {balance?.available != null && holdsTime && (
                <div>
                  <div className={HEADING}>{d.impact}</div>
                  <div className={`text-xs font-semibold ${balance.available < 0 ? 'text-[#f87171]' : 'text-[#e8eaf0]'}`}>
                    {sa.modal.balanceFlow(balance.available + Number(detail.totalHours), balance.available)}
                  </div>
                </div>
              )}

              {detail.reason && (
                <div>
                  <div className={HEADING}>{d.reason}</div>
                  <div className="text-xs text-[#e8eaf0] whitespace-pre-wrap">{detail.reason}</div>
                </div>
              )}
              {detail.reviewNote && (
                <div>
                  <div className={HEADING}>{d.reviewNote}</div>
                  <div className="text-xs text-[#e8eaf0] whitespace-pre-wrap">{detail.reviewNote}</div>
                </div>
              )}

              {holdsTime && (
                <div>
                  <div className={HEADING}>{d.services}</div>
                  {detail.affected.length === 0 && <div className="text-xs text-[#6b7280]">{d.noServices}</div>}
                  {detail.affected.length > 0 && (
                    <>
                      <p className="text-[11px] text-[#6b7280] mb-2">
                        {detail.status === 'approved' ? d.suggestionHint : d.approveFirst}
                      </p>
                      <div className="space-y-2">
                        {detail.affected.map((s: any) => (
                          <div key={s.id} className="bg-[#1e2330] border border-[#2a2f3d] rounded-lg p-3">
                            <div className="text-xs font-semibold text-[#e8eaf0]">#{s.serviceNumber} · {s.client?.name}</div>
                            <div className="text-[11px] text-[#6b7280] mt-0.5">{fmtDate(s.serviceDate)} · {s.serviceTime} · {s.type}</div>
                            {covered.has(s.id) ? (
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-[#38d9a9] mt-2"><Check size={12} />{d.assigned}</div>
                            ) : s.suggestions.length === 0 ? (
                              <div className="text-[11px] text-[#f59e0b] mt-2">{d.noSuggestion}</div>
                            ) : (
                              <div className="flex items-center gap-2 mt-2">
                                <select
                                  value={picks[s.id] ?? ''}
                                  disabled={detail.status !== 'approved'}
                                  onChange={e => setPicks(p => ({ ...p, [s.id]: e.target.value }))}
                                  className="flex-1 min-w-0 px-2 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-[11px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] disabled:opacity-50"
                                >
                                  <option value="">{d.choose}</option>
                                  {s.suggestions.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                  onClick={() => assign(s.id)}
                                  disabled={busy || !picks[s.id] || detail.status !== 'approved'}
                                  className="px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-[11px] font-semibold rounded-lg transition-all disabled:opacity-40"
                                >
                                  {d.assign}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {holdsTime && (
                <div>
                  <div className={HEADING}>{d.reviewNote}</div>
                  <textarea rows={2} value={note} placeholder={d.notePlaceholder} onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors resize-none" />
                </div>
              )}
            </>
          )}
        </div>

        {detail && holdsTime && (
          <div className="px-5 py-4 border-t border-[#2a2f3d] flex items-center justify-end gap-2">
            {detail.status === 'pending' && (
              <>
                <button onClick={() => act('reject')} disabled={busy} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#f87171] hover:border-[#f87171] transition-all disabled:opacity-50">
                  {sa.reject}
                </button>
                <button onClick={() => act('approve')} disabled={busy} className="px-4 py-2 bg-[#38d9a9] hover:bg-[#2fc597] text-[#0d0f14] text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                  {sa.approve}
                </button>
              </>
            )}
            {detail.status === 'approved' && (
              <button onClick={() => act('cancel')} disabled={busy} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#f87171] hover:border-[#f87171] transition-all disabled:opacity-50">
                {sa.cancelAbsence}
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
