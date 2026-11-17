'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Lang = 'en' | 'es'
type Win = 'morning' | 'afternoon' | 'any'

export type PortalData = {
  lang: Lang
  number: string
  clientName: string
  address: string | null
  items: Array<{ description: string; qty: number; total: number }>
  subtotal: number
  tax: number
  taxRate: number
  total: number
  validUntil: string
  notes: string | null
  response: 'accepted' | 'changes' | 'declined' | null
  respondedAt: string | null
  expired: boolean
  booked: { date: string; time: string } | null
  closed: boolean
  pending: 'team' | 'client' | null
  agreed: { date: string; time: string } | null
  proposal: { date: string; time: string; note: string | null } | null
  pick: { date: string; window: Win } | null
  offered: Array<{ date: string; morning: boolean; afternoon: boolean }>
}

const PHONE = '(919) 322-9092'

const T = {
  en: {
    estimate: 'Estimate', preparedFor: 'Prepared for', included: "What's included", validUntil: 'Valid until', subtotal: 'Subtotal', tax: 'Tax', total: 'Total', notes: 'Notes',
    accept: 'Accept estimate', changes: 'Request changes', ask: 'Ask a question', decline: 'Decline', back: 'Back to estimate',
    questionsHint: `Questions before accepting? Ask here, reply to our email, or call ${PHONE}.`,
    whichDay: 'Which day works best?', whichDayAgain: 'Which day works for you?', otherDay: 'Another day…', timeOfDay: 'Time of day',
    win: { morning: 'Morning', afternoon: 'Afternoon', any: 'Any time' } as Record<Win, string>,
    full: 'Full', anything: 'Anything we should know?', optional: '(optional)', anythingPh: 'Gate code, pets, products you prefer…',
    agree: (n: string, t: string) => <>I accept estimate {n} for <b>{t}</b>. Joyful will confirm the exact date and time.</>,
    chooseToContinue: 'Choose a day and a time of day to continue.', chooseAndAgree: 'Choose a day and a time of day, and check the box to continue.',
    reschedHint: "Pick a day that works better for you. We'll confirm it.", sendDay: 'Send this day', messageForUs: 'Message for us', reschedPh: 'For example: I work Mondays, any other day is fine.',
    changesQ: 'What would you like to change?', changesPh: 'For example: skip the oven, add the garage…', sendRequest: 'Send request',
    whyDecline: 'Can you tell us why?', comments: 'Comments', declineBtn: 'Decline estimate',
    reasons: { price: 'Price is too high', other_company: 'Chose another company', not_needed: 'No longer needed', other: 'Other' } as Record<string, string>,
    questionQ: 'What would you like to ask?', questionPh: 'Type your question. We usually answer the same day.', sendQuestion: 'Send question',
    newDate: 'New date from Joyful', insteadOf: (d: string) => `Instead of ${d}`, yesWorks: 'Yes, that works', suggestOther: 'Suggest another day', changeMyDay: 'Change the day I picked',
    bookedFor: (d: string) => `Your cleaning is booked for ${d}.`,
    allSet: (d: string) => `You're all set for ${d}. We'll send your booking confirmation.`,
    acceptedWait: (d: string | null) => `You accepted this estimate${d ? ` and asked for ${d}` : ''}. We'll confirm the date shortly.`,
    changesSent: "You asked for changes. We'll send you an updated estimate.",
    declined: 'You declined this estimate.',
    expired: `This estimate has expired. Call us at ${PHONE} and we'll send you an updated one.`,
    done: {
      accept: ['Thank you!', (d: string) => `We received your acceptance. We'll confirm ${d} shortly.`],
      changes: ['Request sent', () => "We'll review your changes and send you an updated estimate."],
      decline: ['Thanks for letting us know', () => `If anything changes, we're one call away at ${PHONE}.`],
      question: ['Question sent', () => "We'll answer you by email or phone, usually the same day."],
      confirm: ["You're all set!", (d: string) => `We'll see you on ${d}. Your booking confirmation is on its way.`],
      suggest: ['New day sent', (d: string) => `We'll confirm ${d} shortly.`],
    } as Record<string, [string, (d: string) => string]>,
    errors: { 409: 'This estimate changed since you opened it. Go back to see where it stands.', 410: `This estimate has expired. Call us at ${PHONE}.`, 429: 'Too many tries. Wait a few minutes and try again.', other: `Something went wrong. Try again or call us at ${PHONE}.` } as Record<string, string>,
    notFoundTitle: "We couldn't find this estimate", notFoundBody: `The link may be incomplete, or the estimate was withdrawn. Call us at ${PHONE} and we'll help.`,
    sending: 'Sending…', switchLang: 'Ver en español',
  },
  es: {
    estimate: 'Cotización', preparedFor: 'Preparada para', included: 'Qué incluye', validUntil: 'Válida hasta', subtotal: 'Subtotal', tax: 'Impuesto', total: 'Total', notes: 'Notas',
    accept: 'Aceptar cotización', changes: 'Pedir cambios', ask: 'Hacer una pregunta', decline: 'Rechazar', back: 'Volver a la cotización',
    questionsHint: `¿Tienes dudas antes de aceptar? Pregúntanos aquí, responde a nuestro correo o llama al ${PHONE}.`,
    whichDay: '¿Qué día te conviene?', whichDayAgain: '¿Qué día te sirve?', otherDay: 'Otro día…', timeOfDay: 'Hora del día',
    win: { morning: 'En la mañana', afternoon: 'En la tarde', any: 'A cualquier hora' } as Record<Win, string>,
    full: 'Lleno', anything: '¿Algo que debamos saber?', optional: '(opcional)', anythingPh: 'Código del portón, mascotas, productos que prefieres…',
    agree: (n: string, t: string) => <>Acepto la cotización {n} por <b>{t}</b>. Joyful confirmará la fecha y la hora exactas.</>,
    chooseToContinue: 'Elige un día y una hora del día para continuar.', chooseAndAgree: 'Elige un día y una hora del día, y marca la casilla para continuar.',
    reschedHint: 'Elige el día que mejor te quede. Te lo confirmamos.', sendDay: 'Enviar este día', messageForUs: 'Mensaje para nosotros', reschedPh: 'Por ejemplo: los lunes trabajo, cualquier otro día está bien.',
    changesQ: '¿Qué te gustaría cambiar?', changesPh: 'Por ejemplo: sin el horno, agregar el garaje…', sendRequest: 'Enviar solicitud',
    whyDecline: '¿Nos cuentas por qué?', comments: 'Comentarios', declineBtn: 'Rechazar cotización',
    reasons: { price: 'El precio es muy alto', other_company: 'Elegí otra compañía', not_needed: 'Ya no lo necesito', other: 'Otro' } as Record<string, string>,
    questionQ: '¿Qué quieres preguntarnos?', questionPh: 'Escribe tu pregunta. Normalmente respondemos el mismo día.', sendQuestion: 'Enviar pregunta',
    newDate: 'Nueva fecha de Joyful', insteadOf: (d: string) => `En lugar de ${d}`, yesWorks: 'Sí, me sirve', suggestOther: 'Sugerir otro día', changeMyDay: 'Cambiar el día que elegí',
    bookedFor: (d: string) => `Tu limpieza está agendada para el ${d}.`,
    allSet: (d: string) => `Todo listo para el ${d}. Te enviaremos la confirmación del servicio.`,
    acceptedWait: (d: string | null) => `Aceptaste esta cotización${d ? ` y pediste el ${d}` : ''}. Te confirmamos la fecha muy pronto.`,
    changesSent: 'Pediste cambios. Te enviaremos una cotización actualizada.',
    declined: 'Rechazaste esta cotización.',
    expired: `Esta cotización venció. Llámanos al ${PHONE} y te enviamos una actualizada.`,
    done: {
      accept: ['¡Gracias!', (d: string) => `Recibimos tu aceptación. Te confirmamos el ${d} muy pronto.`],
      changes: ['Solicitud enviada', () => 'Revisaremos tus cambios y te enviaremos una cotización actualizada.'],
      decline: ['Gracias por avisarnos', () => `Si algo cambia, llámanos al ${PHONE}.`],
      question: ['Pregunta enviada', () => 'Te responderemos por correo o por teléfono, normalmente el mismo día.'],
      confirm: ['¡Todo listo!', (d: string) => `Nos vemos el ${d}. Te llegará la confirmación del servicio.`],
      suggest: ['Día enviado', (d: string) => `Te confirmamos el ${d} muy pronto.`],
    } as Record<string, [string, (d: string) => string]>,
    errors: { 409: 'Esta cotización cambió desde que la abriste. Vuelve para ver cómo está.', 410: `Esta cotización venció. Llámanos al ${PHONE}.`, 429: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', other: `Algo salió mal. Inténtalo de nuevo o llámanos al ${PHONE}.` } as Record<string, string>,
    notFoundTitle: 'No encontramos esta cotización', notFoundBody: `Puede que el enlace esté incompleto o que la cotización se haya retirado. Llámanos al ${PHONE} y te ayudamos.`,
    sending: 'Enviando…', switchLang: 'View in English',
  },
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-US' }
function fmtDay(date: string, lang: Lang, long = true) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(LOCALE[lang], long
    ? { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }
    : { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
function fmtTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h)) return time
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

type Screen = 'main' | 'accept' | 'resched' | 'changes' | 'decline' | 'question' | 'done'

export default function EstimatePortal({ data, token }: { data: PortalData | null; token: string }) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>(data?.lang ?? 'en')
  const t = T[lang]
  const [screen, setScreen] = useState<Screen>('main')
  const [doneKind, setDoneKind] = useState<string>('')
  const [doneDay, setDoneDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [day, setDay] = useState<string | null>(null)
  const [otherDay, setOtherDay] = useState('')
  const [useOther, setUseOther] = useState(false)
  const [win, setWin] = useState<Win | null>(null)
  const [noteText, setNoteText] = useState('')
  const [agree, setAgree] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    fetch(`/api/public/estimates/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view' }) }).catch(() => {})
  }, [data, token])

  if (!data) {
    return (
      <Frame>
        <div className="px-5 py-16 text-center grid gap-3">
          <h1 className="text-xl font-extrabold">{t.notFoundTitle}</h1>
          <p className="text-sm text-[#6b7280]">{t.notFoundBody}</p>
        </div>
      </Frame>
    )
  }

  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA') })()
  const chosenDay = useOther ? (otherDay || null) : day
  const offeredSel = !useOther ? data.offered.find(o => o.date === day) : undefined
  const winOk = (w: Win) => !offeredSel || w === 'any' ? (!offeredSel || offeredSel.morning || offeredSel.afternoon) : offeredSel[w]

  function open(next: Screen) {
    setError(''); setNoteText(''); setAgree(false); setReason(null); setDay(null); setOtherDay(''); setUseOther(false); setWin(null)
    setScreen(next)
    window.scrollTo({ top: 0 })
  }

  async function send(action: string, payload: Record<string, unknown>, kind: string, dayLabel = '') {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/public/estimates/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }),
      })
      if (!res.ok) { setError(t.errors[String(res.status)] ?? t.errors.other); return }
      setDoneKind(kind); setDoneDay(dayLabel); setScreen('done'); window.scrollTo({ top: 0 })
      router.refresh()
    } catch {
      setError(t.errors.other)
    } finally {
      setBusy(false)
    }
  }

  const dayLabel = (d: string, w: Win) => `${fmtDay(d, lang)}, ${t.win[w].toLowerCase()}`

  /* ── pieces ── */
  const head = (
    <div className="bg-[#4b3fa0] text-white px-5 pt-5 pb-6 grid gap-1">
      <div className="flex justify-between items-center gap-3">
        <span className="font-extrabold text-[15px] tracking-wide">Joyful Cleaning Services</span>
        <button type="button" onClick={() => setLang(lang === 'en' ? 'es' : 'en')} className="text-xs font-semibold underline underline-offset-2 opacity-90">{t.switchLang}</button>
      </div>
      <h1 className="text-2xl font-extrabold mt-2 leading-tight">{t.estimate} {data.number}</h1>
      <p className="text-[13px] opacity-85">{t.preparedFor} {data.clientName}{data.address ? ` · ${data.address.split(',')[0]}` : ''}</p>
    </div>
  )

  const quote = (
    <Card>
      <Label>{t.included}</Label>
      {data.items.map((it, i) => (
        <div key={i} className="flex justify-between gap-3 text-sm">
          <span className="min-w-0">{it.description}{it.qty > 1 ? ` × ${it.qty}` : ''}</span>
          <span className="font-semibold tabular-nums whitespace-nowrap">{money(it.total)}</span>
        </div>
      ))}
      {data.taxRate > 0 && (
        <>
          <div className="flex justify-between text-sm text-[#6b7280] border-t border-[#e5e7eb] pt-2"><span>{t.subtotal}</span><span className="tabular-nums">{money(data.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-[#6b7280]"><span>{t.tax} ({data.taxRate}%)</span><span className="tabular-nums">{money(data.tax)}</span></div>
        </>
      )}
      <div className="flex justify-between items-baseline border-t border-[#e5e7eb] pt-3">
        <span className="text-xs text-[#6b7280]">{t.validUntil} {fmtDay(data.validUntil, lang)}</span>
        <span className="text-[26px] font-extrabold text-[#059669] tabular-nums">{money(data.total)}</span>
      </div>
    </Card>
  )

  const notes = data.notes ? <Card><Label>{t.notes}</Label><p className="text-[13px] whitespace-pre-line">{data.notes}</p></Card> : null
  const backBtn = <button type="button" className="text-[13px] font-semibold text-[#6b7280] py-2" onClick={() => { setScreen('main'); setError('') }}>{t.back}</button>
  const err = error ? <p role="alert" className="text-[13px] text-[#dc2626] text-center">{error}</p> : null
  const askLink = !data.closed && <button type="button" className="text-[13px] font-semibold text-[#4b3fa0] py-2" onClick={() => open('question')}>{t.ask}</button>

  function dayPicker(withAgree: boolean) {
    const ready = !!chosenDay && !!win && (!withAgree || agree)
    return (
      <>
        <Field label={withAgree ? t.whichDay : t.whichDayAgain}>
          <div className="flex flex-wrap gap-2">
            {data!.offered.map(o => (
              <Chip key={o.date} on={!useOther && day === o.date} onClick={() => { setUseOther(false); setDay(o.date); if (win && win !== 'any' && !o[win]) setWin(null) }}>{fmtDay(o.date, lang, false)}</Chip>
            ))}
            <Chip on={useOther} onClick={() => setUseOther(true)}>{t.otherDay}</Chip>
          </div>
          {useOther && (
            <input type="date" min={tomorrow} value={otherDay} onChange={e => setOtherDay(e.target.value)} aria-label={t.otherDay}
              className="mt-2 w-full border border-[#e5e7eb] rounded-[10px] px-3 py-2.5 text-[15px] bg-white text-[#111827]" />
          )}
        </Field>
        <Field label={t.timeOfDay}>
          <div className="flex flex-wrap gap-2">
            {(['morning', 'afternoon', 'any'] as Win[]).map(w => (
              <Chip key={w} on={win === w} disabled={!winOk(w)} onClick={() => setWin(w)}>{t.win[w]}{!winOk(w) ? ` · ${t.full}` : ''}</Chip>
            ))}
          </div>
        </Field>
        <Field label={<>{withAgree ? t.anything : t.messageForUs} <span className="font-medium text-[#6b7280]">{t.optional}</span></>}>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} maxLength={2000} placeholder={withAgree ? t.anythingPh : t.reschedPh} className={inputCls} />
        </Field>
        {withAgree && (
          <button type="button" onClick={() => setAgree(!agree)} className="flex gap-3 items-start text-left text-[13.5px]" aria-pressed={agree}>
            <span className={`w-5 h-5 mt-0.5 rounded-md border-[1.5px] flex-none grid place-items-center text-white text-xs ${agree ? 'bg-[#059669] border-[#059669]' : 'border-[#9ca3af]'}`}>{agree ? '✓' : ''}</span>
            <span>{t.agree(data!.number, money(data!.total))}</span>
          </button>
        )}
        {err}
        <Primary disabled={!ready || busy} onClick={() => chosenDay && win && (withAgree
          ? send('accept', { date: chosenDay, window: win, note: noteText, agree: true }, 'accept', dayLabel(chosenDay, win))
          : send('suggest_date', { date: chosenDay, window: win, note: noteText }, 'suggest', dayLabel(chosenDay, win)))}>
          {busy ? t.sending : withAgree ? t.accept : t.sendDay}
        </Primary>
        {!ready && <p className="text-xs text-[#6b7280] text-center">{withAgree ? t.chooseAndAgree : t.chooseToContinue}</p>}
        {backBtn}
      </>
    )
  }

  /* ── screens ── */
  let body: React.ReactNode
  if (screen === 'done') {
    const [title, text] = t.done[doneKind] ?? t.done.question
    body = (
      <>
        <div className="text-center grid gap-2 justify-items-center pt-4">
          <span className="w-14 h-14 rounded-full grid place-items-center text-white text-2xl bg-[#059669]">✓</span>
          <h2 className="text-xl font-extrabold">{title}</h2>
          <p className="text-[13.5px] text-[#6b7280] max-w-[32ch]">{text(doneDay)}</p>
        </div>
        {quote}
        {backBtn}
      </>
    )
  } else if (screen === 'accept') {
    body = <>{quote}{dayPicker(true)}</>
  } else if (screen === 'resched') {
    body = <><Banner tone="brand">{t.reschedHint}</Banner>{dayPicker(false)}</>
  } else if (screen === 'changes' || screen === 'question') {
    const isQ = screen === 'question'
    body = (
      <>
        {quote}
        <Field label={isQ ? t.questionQ : t.changesQ}>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} maxLength={2000} placeholder={isQ ? t.questionPh : t.changesPh} className={inputCls} />
        </Field>
        {err}
        <Primary disabled={!noteText.trim() || busy} onClick={() => send(isQ ? 'question' : 'changes', { note: noteText }, isQ ? 'question' : 'changes')}>
          {busy ? t.sending : isQ ? t.sendQuestion : t.sendRequest}
        </Primary>
        {backBtn}
      </>
    )
  } else if (screen === 'decline') {
    body = (
      <>
        <Field label={<>{t.whyDecline} <span className="font-medium text-[#6b7280]">{t.optional}</span></>}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(t.reasons).map(([k, label]) => <Chip key={k} on={reason === k} onClick={() => setReason(k)}>{label}</Chip>)}
          </div>
        </Field>
        <Field label={t.comments}><textarea value={noteText} onChange={e => setNoteText(e.target.value)} maxLength={2000} className={inputCls} /></Field>
        {err}
        <button type="button" disabled={busy} onClick={() => send('decline', { reason, note: noteText }, 'decline')}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold border border-[#e5e7eb] bg-white text-[#dc2626] disabled:opacity-50">{busy ? t.sending : t.declineBtn}</button>
        {backBtn}
      </>
    )
  } else {
    // main
    let status: React.ReactNode = null
    let actions: React.ReactNode = null
    if (data.booked) {
      status = <Banner tone="green">{t.bookedFor(`${fmtDay(data.booked.date, lang)}, ${fmtTime(data.booked.time)}`)}</Banner>
    } else if (data.response === 'accepted') {
      if (data.agreed) {
        status = <Banner tone="green">{t.allSet(`${fmtDay(data.agreed.date, lang)}, ${fmtTime(data.agreed.time)}`)}</Banner>
      } else if (data.pending === 'client' && data.proposal) {
        status = (
          <div className="bg-white border-2 border-[#4b3fa0] rounded-2xl p-4 grid gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#4b3fa0]">{t.newDate}</span>
            <b className="text-[19px]">{fmtDay(data.proposal.date, lang)} · {fmtTime(data.proposal.time)}</b>
            {data.pick && <span className="text-[12.5px] text-[#6b7280]">{t.insteadOf(dayLabel(data.pick.date, data.pick.window))}</span>}
            {data.proposal.note && <span className="text-[13px]">“{data.proposal.note}”</span>}
          </div>
        )
        actions = (
          <div className="grid gap-2">
            {err}
            <Primary disabled={busy} onClick={() => send('confirm_date', {}, 'confirm', `${fmtDay(data.proposal!.date, lang)}, ${fmtTime(data.proposal!.time)}`)}>{busy ? t.sending : t.yesWorks}</Primary>
            <Secondary onClick={() => open('resched')}>{t.suggestOther}</Secondary>
          </div>
        )
      } else {
        status = <Banner tone="green">{t.acceptedWait(data.pick ? dayLabel(data.pick.date, data.pick.window) : null)}</Banner>
        actions = <button type="button" className="text-[13px] font-semibold text-[#6b7280] py-2" onClick={() => open('resched')}>{t.changeMyDay}</button>
      }
    } else if (data.response === 'changes') {
      status = <Banner tone="amber">{t.changesSent}</Banner>
    } else if (data.response === 'declined') {
      status = <Banner tone="red">{t.declined}</Banner>
    } else if (data.expired) {
      status = <Banner tone="amber">{t.expired}</Banner>
    } else {
      actions = (
        <div className="grid gap-2">
          <Primary onClick={() => open('accept')}>{t.accept}</Primary>
          <Secondary onClick={() => open('changes')}>{t.changes}</Secondary>
          <Secondary onClick={() => open('question')}>{t.ask}</Secondary>
          <button type="button" className="text-[13px] font-semibold text-[#6b7280] py-2" onClick={() => open('decline')}>{t.decline}</button>
          <p className="text-xs text-[#6b7280] text-center">{t.questionsHint}</p>
        </div>
      )
    }
    body = (
      <>
        {status}
        {data.pending === 'client' && data.proposal && !data.agreed && actions}
        {quote}
        {notes}
        {!(data.pending === 'client' && data.proposal && !data.agreed) && actions}
        {(data.response || data.expired) && askLink}
      </>
    )
  }

  return (
    <Frame>
      {head}
      <div className="px-4 py-5 grid gap-4">{body}</div>
      <p className="text-center text-xs text-[#6b7280] pb-8">Joyful Cleaning Services · {PHONE}</p>
    </Frame>
  )
}

const inputCls = 'w-full border border-[#e5e7eb] rounded-[10px] px-3 py-2.5 text-[15px] bg-white text-[#111827] min-h-[84px] resize-none focus:outline-none focus:border-[#4b3fa0]'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-[#f2f3f7] text-[#111827]" style={{ colorScheme: 'light' }}>
      <div className="max-w-lg mx-auto bg-[#f2f3f7] min-h-screen">{children}</div>
    </main>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 grid gap-2">{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold tracking-wider uppercase text-[#6b7280]">{children}</span>
}
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="grid gap-2"><span className="text-[13.5px] font-bold">{label}</span>{children}</div>
}
function Chip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on}
      className={`rounded-full px-3.5 py-2 text-[13px] font-semibold border transition-colors disabled:opacity-40 ${on ? 'border-[#4b3fa0] bg-[#efedfa] text-[#4b3fa0]' : 'border-[#e5e7eb] bg-white text-[#111827]'}`}>
      {children}
    </button>
  )
}
function Primary({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="w-full rounded-xl py-3.5 text-[15px] font-bold bg-[#059669] text-white disabled:opacity-45">{children}</button>
}
function Secondary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="w-full rounded-xl py-3.5 text-[15px] font-bold bg-white border border-[#e5e7eb] text-[#111827]">{children}</button>
}
function Banner({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'brand'; children: React.ReactNode }) {
  const cls = { green: 'bg-[#ecfdf5] text-[#047857]', amber: 'bg-[#fffbeb] text-[#b45309]', red: 'bg-[#fef2f2] text-[#b91c1c]', brand: 'bg-[#efedfa] text-[#4b3fa0]' }[tone]
  return <div className={`rounded-xl px-3.5 py-3 text-[13.5px] ${cls}`}>{children}</div>
}
