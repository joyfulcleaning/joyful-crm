'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MoreHorizontal, X, Phone, Mail, MapPin } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { visitStage, stageColor, STAGE_STEP, ESTIMATE_VISIT_COLOR, VisitStage } from '@/lib/estimate-stage'
import ServiceModal, { TIME_SLOTS } from './ServiceModal'
import ConfirmModal from './ConfirmModal'

// An estimate visit from the calendar, start to finish — the web twin of the
// app's EstimateVisitModal: confirm the visit to the client, send the
// estimate, follow what the client did on their link, settle the date and
// book the service. Creating or editing the estimate itself happens in
// Finances, which sends you back here when it's saved. Admin only.

type Lang = 'en' | 'es'
type Via = 'email' | 'sms'
type Sheet = null | 'send' | 'confirm' | 'propose' | 'edit'

const money = (n: unknown) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ymd = (v?: string | null) => (v || '').slice(0, 10)
const firstName = (n?: string | null) => (n || '').trim().split(/\s+/)[0] || ''
const digits = (p?: string | null) => (p || '').replace(/[^\d+]/g, '')

function fmtTime(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Next weekdays from tomorrow, for the "propose another date" chips.
function nextWorkingDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  while (out.length < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
  }
  return out
}

// Matches WINDOW_START in lib/estimate-flow.ts.
const WINDOW_START: Record<string, string> = { morning: '09:00', afternoon: '13:00', any: '10:00' }

const inputCls = 'w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[#4f8ef7]'
const lblCls = 'text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider'

export default function EstimateVisitModal({ visitId, onClose, onChanged }: {
  visitId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const T = t.estimateVisit
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClient, setConfirmClient] = useState(false)
  const [service, setService] = useState<null | { clientId: string; date?: string; time?: string; notes: string; address: string; price: string }>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [lang, setLang] = useState<Lang>('en')
  const [via, setVia] = useState<Via>('email')
  const [propDate, setPropDate] = useState<string | null>(null)
  const [propOther, setPropOther] = useState('')
  const [propTime, setPropTime] = useState<string | null>(null)
  const [propNote, setPropNote] = useState('')
  const [edit, setEdit] = useState<any>(null)

  const load = useCallback(async () => {
    if (!visitId) return
    try {
      const res = await fetch(`/api/estimate-visits/${visitId}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      setVisit(data)
      setError('')
    } catch {
      setError(T.loadError)
    } finally {
      setLoading(false)
    }
  }, [visitId, T.loadError])

  useEffect(() => {
    setSheet(null); setMenuOpen(false); setNotice('')
    if (!visitId) { setVisit(null); return }
    setLoading(true)
    load()
  }, [visitId, load])

  // Esc backs out one layer at a time: menu, then the open panel, then the visit.
  const anyDialog = confirmDelete || confirmClient || !!service
  useEffect(() => {
    if (!visitId) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || anyDialog) return
      if (menuOpen) setMenuOpen(false)
      else if (sheet) setSheet(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visitId, menuOpen, sheet, anyDialog, onClose])

  // Clicking anywhere outside the ⋯ menu closes it.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(id)
  }, [notice])

  if (!visitId) return null

  const refresh = async () => { await load(); onChanged() }

  const est = visit?.estimate ?? null
  const stage: VisitStage = visit ? visitStage(visit) : 'scheduled'
  const color = stageColor(stage)
  const first = firstName(visit?.name)
  const email = visit?.email || visit?.client?.email || ''
  const phone = visit?.phone || visit?.client?.phone || ''
  const events: any[] = Array.isArray(est?.events) ? est.events : []
  const lastOf = (type: string, by?: string) => [...events].reverse().find(e => e.type === type && (!by || e.by === by))
  const lastClientPick = [...events].reverse().find(e => (e.type === 'accepted' && e.by === 'client') || e.type === 'suggested')
  const lastProposal = lastOf('proposed')

  const fmtDay = (iso?: string | null, long = false) => iso
    ? new Date(`${ymd(iso)}T12:00:00`).toLocaleDateString(t.locale, long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })
    : ''
  const fmtWhen = (iso?: string | null) => iso
    ? new Date(iso).toLocaleString(t.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''
  const viaLabel = (v?: string) => v === 'sms' ? T.viaText : v === 'phone' ? T.viaPhone : T.viaEmail
  const pickLabel = (e: any) => e?.date ? `${fmtDay(e.date)}${e.time ? `, ${fmtTime(e.time)}` : e.window ? `, ${T.windows[e.window]}` : ''}` : ''

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || T.error)
    return data
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('')
    try { await fn() } catch (err: any) { setError(err?.message || T.error) } finally { setBusy(false) }
  }

  // The office texts clients from its own phone, so on the web the text is
  // copied for them to paste.
  async function copySms(body: string, to?: string | null) {
    try { await navigator.clipboard.writeText(body) } catch {}
    setNotice(to ? T.smsCopied(to) : T.smsCopiedNoPhone)
  }

  /* ── actions ── */
  function openSend() { setLang((est?.lang as Lang) || (visit?.lang as Lang) || 'en'); setVia(est?.clientEmail || email ? 'email' : 'sms'); setSheet('send') }
  function openConfirm() { setLang((visit?.lang as Lang) || 'en'); setVia(email ? 'email' : 'sms'); setSheet('confirm') }
  function openPropose() { setLang((est?.lang as Lang) || 'en'); setVia(est?.clientEmail ? 'email' : 'sms'); setPropDate(null); setPropOther(''); setPropTime(null); setPropNote(''); setSheet('propose') }
  function openEdit() {
    setEdit({
      name: visit.name ?? '', phone: visit.phone ?? '', email: visit.email ?? '', address: visit.address ?? '',
      date: ymd(visit.visitDate), time: visit.visitTime ?? '', notes: visit.notes ?? '', lang: visit.lang || 'en', notify: false,
    })
    setSheet('edit')
  }
  const goEstimate = (mode: 'new' | 'edit') => router.push(mode === 'new'
    ? `/finances?tab=estimates&fromVisit=${visit.id}`
    : `/finances?tab=estimates&estimate=${est.id}&returnVisit=${visit.id}`)

  const doSend = () => run(async () => {
    if (via === 'email') {
      if (!est.clientEmail) throw new Error(T.missingEmail)
      await post(`/api/estimates/${est.id}/email`, { lang })
      setSheet(null); await refresh()
      setNotice(T.sentEmailOk(est.clientEmail))
    } else {
      const data = await post(`/api/estimates/${est.id}/text`, { lang })
      setSheet(null); await refresh()
      await copySms(data.sms, data.phone || phone)
    }
  })

  const doConfirm = () => run(async () => {
    if (via === 'email' && !email) throw new Error(T.missingEmail)
    const data = await post(`/api/estimate-visits/${visit.id}/confirm`, { via, lang })
    setSheet(null); await refresh()
    if (via === 'sms') await copySms(data.sms, data.phone || phone)
    else setNotice(T.confirmSentOk(first))
  })

  const doPropose = () => run(async () => {
    const date = propDate === 'other' ? propOther : propDate
    if (!date || !propTime) throw new Error(T.pickDayTime)
    const data = await post(`/api/estimates/${est.id}/flow`, { action: 'propose', date, time: propTime, note: propNote, via, lang })
    setSheet(null); await refresh()
    if (via === 'sms') await copySms(data.sms, data.phone || phone)
    else setNotice(T.proposalSentOk(first))
  })

  const doSaveEdit = () => run(async () => {
    if (!edit.name.trim() || !edit.date || !edit.time) throw new Error(T.needNameDate)
    const changedWhen = edit.date !== ymd(visit.visitDate) || edit.time !== visit.visitTime
    const res = await fetch(`/api/estimate-visits/${visit.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: edit.name.trim(), phone: edit.phone, email: edit.email, address: edit.address, visitDate: edit.date, visitTime: edit.time, notes: edit.notes, lang: edit.lang }),
    })
    if (!res.ok) throw new Error(T.error)
    if (edit.notify && changedWhen) {
      const confirmVia: Via = edit.email ? 'email' : 'sms'
      const data = await post(`/api/estimate-visits/${visit.id}/confirm`, { via: confirmVia, lang: edit.lang, updated: true })
      if (confirmVia === 'sms') await copySms(data.sms, data.phone || edit.phone)
    }
    setSheet(null); await refresh()
  })

  const flow = (action: string, extra: object = {}) => run(async () => {
    await post(`/api/estimates/${est.id}/flow`, { action, ...extra })
    await refresh()
  })

  const patchStatus = (status: string) => run(async () => {
    const res = await fetch(`/api/estimate-visits/${visit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) throw new Error(T.error)
    await refresh()
  })

  const doDelete = () => run(async () => {
    setConfirmDelete(false)
    const res = await fetch(`/api/estimate-visits/${visit.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(T.error)
    onChanged(); onClose()
  })

  // A visit from someone not in the CRM gets a client first, because a
  // service always belongs to one.
  function startService() {
    if (!isAdmin) return setError(T.adminOnly)
    const clientId = visit.clientId || est?.clientId
    if (!clientId) return setConfirmClient(true)
    openService(clientId)
  }

  const createClientThenService = () => run(async () => {
    setConfirmClient(false)
    const res = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: visit.name, phone: phone || null, email: email || null, address: visit.address || null }),
    })
    const created = await res.json().catch(() => ({}))
    if (!res.ok || !created?.id) throw new Error(created?.error || T.error)
    await post(`/api/estimates/${est.id}/flow`, { action: 'set_client', clientId: created.id })
    openService(created.id)
  })

  function openService(clientId: string) {
    const agreed = est.agreedDate ? { date: ymd(est.agreedDate), time: est.agreedTime } : null
    const proposal = est.schedulingPending === 'client' && lastProposal ? { date: lastProposal.date, time: lastProposal.time } : null
    const pick = lastClientPick?.date ? { date: lastClientPick.date, time: WINDOW_START[lastClientPick.window as string] || '09:00' } : null
    const when = agreed || proposal || pick
    const clientNote = [...events].reverse().find(e => e.by === 'client' && e.note && (e.type === 'accepted' || e.type === 'suggested'))?.note
    setService({
      clientId,
      date: when?.date, time: when?.time || undefined,
      notes: [visit.notes, clientNote ? `${T.clientNoteLabel} ${clientNote}` : ''].filter(Boolean).join('\n'),
      address: visit.address || est.clientAddress || '',
      price: String(Number(est.total || 0)),
    })
  }

  async function onServiceCreated(serviceId?: string) {
    setService(null)
    if (!serviceId) return
    await run(async () => {
      await post(`/api/estimates/${est.id}/flow`, { action: 'link_service', serviceId })
      await refresh()
    })
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/e/${est.publicToken}`) } catch {}
    setNotice(T.linkCopied)
  }

  function menuItems() {
    const items: Array<{ text: string; onClick: () => void; danger?: boolean }> = [
      { text: T.editVisit, onClick: openEdit },
      { text: visit.confirmationSentAt ? T.resendConfirmation : T.sendConfirmation, onClick: openConfirm },
    ]
    if (est && ['sent', 'viewed', 'changes', 'declined'].includes(stage)) items.push({ text: T.markAccepted, onClick: () => flow('mark_accepted') })
    if (['accepted', 'proposed', 'agreed'].includes(stage)) items.push({ text: T.proposeDate, onClick: openPropose })
    if (est && ['changes', 'declined', 'accepted', 'proposed', 'agreed'].includes(stage)) items.push({ text: T.reopenEstimate, onClick: () => flow('reopen') })
    if (stage !== 'cancelled' && stage !== 'service') items.push({ text: T.cancelVisit, onClick: () => patchStatus('cancelled') })
    items.push({ text: T.deleteVisit, onClick: () => setConfirmDelete(true), danger: true })
    return items
  }

  /* ── render pieces ── */
  const Btn = ({ label, onClick, kind = 'secondary', col }: { label: string; onClick: () => void; kind?: 'primary' | 'secondary' | 'link'; col?: string }) => (
    kind === 'link'
      ? <button onClick={onClick} disabled={busy} className="self-center text-xs font-bold text-[#a78bfa] hover:underline disabled:opacity-50 py-1">{label}</button>
      : <button onClick={onClick} disabled={busy}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50 ${kind === 'primary' ? 'text-white hover:opacity-90' : 'border border-[var(--border)] text-[var(--text)] hover:border-[#4f8ef7]'}`}
          style={kind === 'primary' ? { background: col || '#4b3fa0' } : undefined}>
          {busy && kind === 'primary' ? '…' : label}
        </button>
  )
  const why = (txt: string, col?: string) => <p className="text-xs text-center" style={{ color: col || 'var(--muted2)' }}>{txt}</p>

  function cta() {
    if (!visit || !isAdmin) return null
    switch (stage) {
      case 'scheduled': return <><Btn kind="primary" label={T.createEstimate} onClick={() => goEstimate('new')} /><Btn label={visit.confirmationSentAt ? T.resendConfirmation : T.sendConfirmation} onClick={openConfirm} /></>
      case 'quoted': return <><Btn kind="primary" label={T.sendToClient} onClick={openSend} />{why(T.sendHint)}</>
      case 'sent':
      case 'viewed': return <>{why(T.waiting(first))}<Btn label={T.resend} onClick={openSend} /><Btn kind="link" label={T.acceptedByPhone} onClick={() => flow('mark_accepted')} /></>
      case 'changes': return <><Btn kind="primary" label={T.editEstimate} onClick={() => goEstimate('edit')} /><Btn label={T.resendToClient} onClick={openSend} /></>
      case 'declined': return <>{phone && <a href={`tel:${digits(phone)}`} className="w-full py-2.5 rounded-xl text-sm font-bold text-center border border-[var(--border)] text-[var(--text)] hover:border-[#4f8ef7]">{T.callClient(first)}</a>}<Btn kind="link" label={T.reopenEstimate} onClick={() => flow('reopen')} /></>
      case 'accepted': return <>{lastClientPick && why(lastClientPick.type === 'suggested' ? T.suggestsDay(first, pickLabel(lastClientPick)) : T.pickedDay(first, pickLabel(lastClientPick)))}<Btn kind="primary" col="#26BD97" label={lastClientPick ? T.scheduleThatDay : T.scheduleService} onClick={startService} /><Btn label={T.proposeDate} onClick={openPropose} /></>
      case 'proposed': return <>{lastProposal && why(T.waitingDate(first, pickLabel(lastProposal)))}<Btn label={T.scheduleAnyway} onClick={startService} /><Btn kind="link" label={T.proposeDate} onClick={openPropose} /></>
      case 'agreed': return <>{why(T.dateConfirmed(first, `${fmtDay(est.agreedDate)}, ${fmtTime(est.agreedTime)}`), '#26BD97')}<Btn kind="primary" col="#26BD97" label={T.scheduleService} onClick={startService} /></>
      case 'cancelled': return <Btn label={T.reopenVisit} onClick={() => patchStatus('scheduled')} />
      default: return null
    }
  }

  function eventLine(e: any, i: number) {
    let txt = ''
    let col = 'var(--muted2)'
    const who = e.userName ? ` · ${e.userName}` : ''
    switch (e.type) {
      case 'sent': txt = T.ev.sent(viaLabel(e.via)) + who; col = '#4f8ef7'; break
      case 'viewed': txt = T.ev.viewed(first); col = '#4f8ef7'; break
      case 'question': txt = T.ev.question(first, e.note); break
      case 'accepted': txt = e.by === 'team' ? T.ev.acceptedPhone + who : T.ev.accepted(first, pickLabel(e)); col = '#26BD97'; break
      case 'changes': txt = T.ev.changes(first, e.note); col = '#f59e0b'; break
      case 'declined': txt = T.ev.declined(first, [e.reason ? T.reasons[e.reason] : '', e.note].filter(Boolean).join(' · ')); col = '#f87171'; break
      case 'proposed': txt = T.ev.proposed(pickLabel(e)) + who; col = '#4f8ef7'; break
      case 'suggested': txt = T.ev.suggested(first, pickLabel(e), e.note); break
      case 'confirmed': txt = T.ev.confirmed(first, pickLabel(e)); col = '#26BD97'; break
      case 'reopened': txt = T.ev.reopened + who; break
      case 'service': txt = T.ev.service + who; col = '#a78bfa'; break
      default: return null
    }
    return (
      <div key={i} className="flex gap-2.5 py-1.5">
        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: col }} />
        <div className="flex-1">
          <div className="text-sm text-[var(--text)]">{txt}</div>
          <div className="text-[11px] text-[var(--muted)]">{fmtWhen(e.at)}</div>
          {e.type === 'question' && (
            <div className="flex gap-2 mt-1.5">
              {!!(est?.clientEmail || email) && <a className={chipCls} href={`mailto:${est?.clientEmail || email}?subject=${encodeURIComponent(`Re: ${est?.estimateNumber}`)}`}>{T.replyEmail}</a>}
              {!!phone && <a className={chipCls} href={`sms:${digits(phone)}`}>{T.replyText}</a>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const stepIdx = STAGE_STEP[stage]
  const stepState = (i: number) => {
    if (stage === 'service' || i < stepIdx) return 'done'
    if (i === stepIdx) return stage === 'declined' ? 'bad' : ['accepted', 'proposed', 'agreed'].includes(stage) ? 'done' : 'cur'
    return ''
  }
  const ctaNode = cta()
  const card = 'bg-[var(--surface2)] border border-[var(--border)] rounded-2xl p-4'
  const linkCls = 'text-xs font-bold text-[#a78bfa] hover:underline'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold tracking-wider" style={{ color: ESTIMATE_VISIT_COLOR }}>{T.eyebrow}</div>
            <div className="text-lg font-extrabold text-[var(--text)] truncate">{visit?.name ?? ''}</div>
          </div>
          {!!visit && (
            <span className="px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide"
              style={{ color, background: `${color}22`, borderColor: `${color}55` }}>{T.stage[stage]}</span>
          )}
          {!!visit && isAdmin && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(o => !o)} title={T.actions}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)]">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-10 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.45)] py-1">
                  {menuItems().map(it => (
                    <button key={it.text} onClick={() => { setMenuOpen(false); it.onClick() }}
                      className={`w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--surface3)] ${it.danger ? 'text-[#f87171]' : 'text-[var(--text)]'}`}>
                      {it.text}
                    </button>
                  ))}
                  <div className="border-t border-[var(--border)] mt-1 pt-1">
                    <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3.5 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface3)]">{T.cancel}</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={onClose} title={T.close} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)]">
            <X size={18} />
          </button>
        </div>

        {(notice || error) && (
          <div className={`mx-5 mb-2 px-3 py-2 rounded-lg text-xs font-semibold ${error ? 'bg-[#f87171]/10 text-[#f87171]' : 'bg-[#26BD97]/10 text-[#26BD97]'}`}>
            {error || notice}
          </div>
        )}

        {loading || !visit ? (
          <div className="flex-1 flex items-center justify-center py-16 text-sm text-[var(--muted)]">{loading ? '…' : error}</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
              <div>
                <div className="text-sm text-[var(--muted2)] capitalize">{fmtDay(visit.visitDate, true)} · {fmtTime(visit.visitTime)}</div>
                <div className="text-xs mt-1" style={{ color: visit.confirmationSentAt ? '#26BD97' : 'var(--muted)' }}>
                  {visit.confirmationSentAt ? T.confirmedAt(fmtWhen(visit.confirmationSentAt), viaLabel(visit.confirmationVia)) : T.notConfirmed}
                </div>
              </div>

              {stage !== 'cancelled' && (
                <div className="flex py-1">
                  {T.steps.map((s: string, i: number) => {
                    const st = stepState(i)
                    const col = st === 'bad' ? '#f87171' : '#a78bfa'
                    return (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative">
                        {i > 0 && <div className="absolute top-[10px] right-1/2 w-full h-0.5" style={{ background: st ? '#a78bfa' : 'var(--border)' }} />}
                        <div className="relative w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center bg-[var(--surface)]"
                          style={st === 'done' ? { background: '#a78bfa', borderColor: '#a78bfa' } : { borderColor: st ? col : 'var(--border)' }}>
                          {st === 'done' ? <span className="text-white text-[10px] font-black">✓</span> : st ? <span className="w-2 h-2 rounded-full" style={{ background: col }} /> : null}
                        </div>
                        <span className="text-[10px] font-bold text-center" style={{ color: st ? 'var(--text)' : 'var(--muted)' }}>{s}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* What the client did on the link */}
              {!!est?.response && (
                <div className="rounded-2xl p-4 border" style={{ borderColor: `${color}66`, background: `${color}12` }}>
                  <div className="text-sm font-extrabold" style={{ color }}>
                    {est.response === 'accepted' ? T.respAccepted(first) : est.response === 'changes' ? T.respChanges(first) : T.respDeclined(first)}
                  </div>
                  <div className="text-xs text-[var(--muted)]">{fmtWhen(est.respondedAt)} · {lastOf('accepted', 'team') && est.response === 'accepted' ? T.byPhone : T.fromLink}</div>
                  {!!est.responseNote && <div className="text-sm italic text-[var(--text)] mt-1.5">“{est.responseNote}”</div>}
                </div>
              )}

              {/* Contact */}
              <div className={card}>
                <div className={lblCls}>{T.contact}</div>
                {!!phone && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <Phone size={13} className="text-[var(--muted)]" />
                    <span className="flex-1 text-sm text-[var(--text)]">{phone}</span>
                    <a className={chipCls} href={`tel:${digits(phone)}`}>{T.call}</a>
                    <a className={chipCls} href={`sms:${digits(phone)}`}>{T.text}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  <Mail size={13} className="text-[var(--muted)]" />
                  <span className={`flex-1 text-sm ${email ? 'text-[var(--text)]' : 'text-[#f59e0b]'}`}>{email || T.noEmail}</span>
                  {!email && <button className={chipCls} onClick={openEdit}>{T.add}</button>}
                </div>
                {!!visit.address && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <MapPin size={13} className="text-[var(--muted)]" />
                    <span className="flex-1 text-sm text-[var(--text)]">{visit.address}</span>
                    <a className={chipCls} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.address)}`}>{T.maps}</a>
                  </div>
                )}
              </div>

              {/* Estimate */}
              <div className={card}>
                <div className={lblCls}>{T.estimate}</div>
                {!est ? (
                  <div className="border-[1.5px] border-dashed border-[var(--border)] rounded-xl p-4 text-center mt-2.5">
                    <div className="text-sm font-bold text-[var(--text)]">{T.noEstimateTitle}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">{T.noEstimateBody}</div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-mono text-xs text-[var(--muted2)]">{est.estimateNumber}</span>
                      <span className="text-xs text-[var(--muted)]">{T.validUntil(fmtDay(est.validUntil))}</span>
                    </div>
                    {(Array.isArray(est.items) ? est.items : []).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between gap-3 mt-1.5 text-xs">
                        <span className="flex-1 text-[var(--muted2)]">{it.description}{Number(it.qty) > 1 ? ` × ${it.qty}` : ''}</span>
                        <span className="text-[var(--text)]">{money(Number(it.qty ?? 1) * Number(it.unitPrice ?? it.unit_price ?? 0))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-[var(--border)] pt-2.5 mt-2.5">
                      <span className={lblCls}>{T.total}</span>
                      <span className="text-xl font-extrabold text-[#26BD97]">{money(est.total)}</span>
                    </div>
                    <div className="text-xs mt-2" style={{ color: est.sentAt || est.emailSentAt ? '#4f8ef7' : 'var(--muted)' }}>
                      {est.sentAt || est.emailSentAt ? T.sentVia(viaLabel(est.sentVia || 'email'), fmtWhen(est.sentAt || est.emailSentAt)) : T.notSent}
                    </div>
                    {!!est.viewedAt && <div className="text-xs text-[#4f8ef7] mt-0.5">{T.openedAt(fmtWhen(est.viewedAt))}</div>}
                    {isAdmin && (
                      <div className="flex flex-wrap gap-4 mt-2.5">
                        <a className={linkCls} href={`/api/estimates/${est.id}/pdf`} target="_blank" rel="noreferrer">{T.viewPdf}</a>
                        {stage !== 'service' && <button className={linkCls} onClick={() => goEstimate('edit')}>{T.edit}</button>}
                        {!!est.publicToken && <button className={linkCls} onClick={copyLink}>{T.copyLink}</button>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Service it became */}
              {!!est?.service && (
                <div className={card}>
                  <div className={lblCls}>{T.service}</div>
                  <div className="text-sm font-bold text-[var(--text)] mt-1">{T.serviceLine(est.service.serviceNumber, est.service.type)}</div>
                  <div className="text-xs text-[var(--muted)]">{fmtDay(est.service.serviceDate, true)} · {fmtTime(est.service.serviceTime)}</div>
                </div>
              )}

              {/* History of the client flow */}
              {events.length > 0 && (
                <div className={card}>
                  <div className={lblCls}>{T.history}</div>
                  <div className="mt-1.5">{[...events].reverse().map(eventLine)}</div>
                </div>
              )}

              <div className={card}>
                <div className="flex justify-between items-center">
                  <span className={lblCls}>{T.notes}</span>
                  {isAdmin && <button className={linkCls} onClick={openEdit}>{T.editVisit}</button>}
                </div>
                <div className="text-sm text-[var(--muted2)] mt-1.5 whitespace-pre-line">{visit.notes || T.noNotes}</div>
              </div>
            </div>

            {!!ctaNode && <div className="px-5 py-3 border-t border-[var(--border)] flex flex-col gap-2">{ctaNode}</div>}
          </>
        )}

        {/* ── Panels: send, confirm, propose, edit ── */}
        {!!sheet && !!visit && (
          <div className="absolute inset-0 z-20 flex flex-col bg-[var(--surface)] rounded-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <button onClick={() => setSheet(null)} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">{T.cancel}</button>
              <div className="text-sm font-extrabold text-[var(--text)] truncate mx-3">
                {sheet === 'send' ? T.sendTitle(est?.estimateNumber ?? '') : sheet === 'confirm' ? T.confirmTitle(first) : sheet === 'propose' ? T.proposeTitle(first) : T.editVisit}
              </div>
              <button onClick={() => setSheet(null)} title={T.close} className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && <div className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#f87171]/10 text-[#f87171]">{error}</div>}
              {sheet !== 'edit' && (
                <>
                  <Seg label={T.language} options={[['en', T.english], ['es', T.spanish]]} value={lang} onChange={v => setLang(v as Lang)} />
                  <div className="space-y-2">
                    <div className={lblCls}>{T.channel}</div>
                    <Option on={via === 'email'} title={T.email} sub={(sheet === 'send' || sheet === 'propose' ? est?.clientEmail : email) || T.missingEmail} onClick={() => setVia('email')} />
                    <Option on={via === 'sms'} title={T.textMsg} sub={phone ? `${phone} · ${T.textOnWeb}` : T.noPhone} onClick={() => setVia('sms')} />
                  </div>
                </>
              )}

              {sheet === 'send' && <p className="text-xs text-[var(--muted)]">{T.sendExplain}</p>}

              {sheet === 'propose' && (
                <>
                  {lastClientPick && <p className="text-xs text-[var(--muted)]">{T.pickedDay(first, pickLabel(lastClientPick))}</p>}
                  <div className="space-y-2">
                    <div className={lblCls}>{T.day}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {nextWorkingDays(6).map(d => <Chip key={d} on={propDate === d} label={fmtDay(d)} onClick={() => setPropDate(d)} />)}
                      <Chip on={propDate === 'other'} label={T.otherDayChip} onClick={() => setPropDate('other')} />
                    </div>
                    {propDate === 'other' && <input type="date" className={inputCls} value={propOther} onChange={e => setPropOther(e.target.value)} />}
                  </div>
                  <div className="space-y-2">
                    <div className={lblCls}>{T.time}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_SLOTS.filter(s => s.value >= '08:00' && s.value <= '17:00' && s.value.endsWith(':00')).map(s => (
                        <Chip key={s.value} on={propTime === s.value} label={s.label} onClick={() => setPropTime(s.value)} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className={lblCls}>{T.messageFor(first)}</div>
                    <textarea className={`${inputCls} min-h-[70px]`} value={propNote} onChange={e => setPropNote(e.target.value)} placeholder={T.proposeNotePh} />
                  </div>
                </>
              )}

              {sheet === 'edit' && edit && (
                <>
                  <Field label={T.name} value={edit.name} onChange={v => setEdit({ ...edit, name: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className={lblCls}>{T.date.replace(/\s*\(.*\)/, '')}</div>
                      <input type="date" className={inputCls} value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <div className={lblCls}>{T.time}</div>
                      <select className={inputCls} value={edit.time} onChange={e => setEdit({ ...edit, time: e.target.value })}>
                        {!TIME_SLOTS.some(s => s.value === edit.time) && edit.time && <option value={edit.time}>{fmtTime(edit.time)}</option>}
                        {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <Field label={T.phone} value={edit.phone} onChange={v => setEdit({ ...edit, phone: v })} type="tel" />
                  <Field label={T.emailLbl} value={edit.email} onChange={v => setEdit({ ...edit, email: v })} type="email" />
                  <Field label={T.address} value={edit.address} onChange={v => setEdit({ ...edit, address: v })} />
                  <div className="space-y-1.5">
                    <div className={lblCls}>{T.notesLbl}</div>
                    <textarea className={`${inputCls} min-h-[80px]`} value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
                  </div>
                  <Seg label={T.language} options={[['en', T.english], ['es', T.spanish]]} value={edit.lang} onChange={v => setEdit({ ...edit, lang: v })} />
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface2)] cursor-pointer">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[var(--text)]">{T.notifyChange}</div>
                      <div className="text-xs text-[var(--muted)]">{T.notifyChangeSub}</div>
                    </div>
                    <input type="checkbox" checked={edit.notify} onChange={e => setEdit({ ...edit, notify: e.target.checked })} className="w-4 h-4 accent-[#26BD97]" />
                  </label>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[var(--border)]">
              <button disabled={busy}
                onClick={sheet === 'send' ? doSend : sheet === 'confirm' ? doConfirm : sheet === 'propose' ? doPropose : doSaveEdit}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#4b3fa0] hover:bg-[#3a2f90] disabled:opacity-50">
                {busy ? '…' : sheet === 'edit' ? T.save : sheet === 'propose' ? T.proposeBtn : via === 'sms' ? T.textMsg : T.sendEmailBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={T.deleteTitle(first)}
        message={est ? `${T.deleteMsgWithEstimate(est.estimateNumber)} ${T.deleteMsg}` : T.deleteMsg}
        confirmLabel={T.deleteVisit}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmModal
        open={confirmClient}
        title={T.createClientTitle}
        message={visit ? T.createClientMsg(visit.name) : ''}
        confirmLabel={T.createClient}
        danger={false}
        onConfirm={createClientThenService}
        onCancel={() => setConfirmClient(false)}
      />
      <ServiceModal
        open={!!service}
        onClose={() => setService(null)}
        onSuccess={onServiceCreated}
        initialClientId={service?.clientId}
        initialDate={service?.date}
        initialTime={service?.time}
        initialNotes={service?.notes}
        initialAddress={service?.address}
        initialBasePrice={service?.price}
      />
    </div>
  )
}

const chipCls = 'px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface3)] text-[11px] font-bold text-[var(--text)] hover:border-[#4f8ef7]'

/* ── small form pieces ── */
function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${on ? 'border-[#a78bfa] bg-[#a78bfa]/15 text-[#a78bfa]' : 'border-[var(--border)] bg-[var(--surface2)] text-[var(--muted2)] hover:border-[#4f8ef7]'}`}>
      {label}
    </button>
  )
}
function Seg({ label, options, value, onChange }: { label: string; options: Array<[string, string]>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className={lblCls}>{label}</div>
      <div className="flex bg-[var(--surface2)] border border-[var(--border)] rounded-lg p-0.5">
        {options.map(([k, l]) => (
          <button key={k} onClick={() => onChange(k)}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold ${value === k ? 'bg-[#4b3fa0] text-white' : 'text-[var(--muted)]'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
function Option({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-xl border-[1.5px] ${on ? 'border-[#a78bfa] bg-[#a78bfa]/10' : 'border-[var(--border)] bg-[var(--surface2)]'}`}>
      <div className="text-sm font-bold text-[var(--text)]">{title}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>
    </button>
  )
}
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <div className={lblCls}>{label}</div>
      <input type={type} className={inputCls} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
