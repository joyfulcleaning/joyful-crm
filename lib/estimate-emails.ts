import { escapeHtml as esc } from './service-emails'
import { FlowLang, firstName, prettyDate, prettyTime } from './estimate-flow'

/**
 * Everything the client receives during the estimate flow, in English or
 * Spanish (English by default). Same branded shell as the service and
 * invoice emails. Each message also has an SMS version for when the team
 * sends it from the phone's Messages app instead.
 */

const BIZ_PHONE = '(919) 322-9092'
const BIZ_EMAIL = 'joyfulcleaningservicescorp@gmail.com'

const SHELL = {
  en: { regards: 'Warm regards,', team: 'Joyful Cleaning Services Team' },
  es: { regards: 'Un cordial saludo,', team: 'Equipo de Joyful Cleaning Services' },
}

function shell(lang: FlowLang, inner: string): string {
  const C = SHELL[lang]
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
</head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#4b3fa0;padding:28px 32px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:#ffffff;">Joyful Cleaning Services</div>
    </div>
    <div style="padding:32px;">
${inner}
      <p style="font-size:13px;color:#374151;margin-top:20px;">
        ${C.regards}<br/>
        <strong>${C.team}</strong><br/>
        <span style="color:#6b7280">${BIZ_PHONE} · ${BIZ_EMAIL}</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">
        Joyful Cleaning Services · 320 Laketree Blvd, Spring Lake NC 28390<br/>
        joyfulcleaningservicesnc.com · ${BIZ_EMAIL}
      </div>
    </div>
  </div>
</body>
</html>`
}

const p = (html: string) => `      <p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 16px;">${html}</p>`
const hello = (lang: FlowLang, name: string) =>
  `      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 16px;">${lang === 'es' ? `Hola, ${esc(firstName(name))}:` : `Hello, ${esc(firstName(name))}!`}</p>`

function summary(title: string, rows: Array<[string, string, string?]>): string {
  const body = rows.map(([label, value, color], i) => `
          <tr${i < rows.length - 1 ? ' style="border-bottom:1px solid #f3f4f6;"' : ''}>
            <td style="padding:6px 0;color:#4b5563;vertical-align:top;">${esc(label)}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:${color || '#111827'};">${value}</td>
          </tr>`).join('')
  return `      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${esc(title)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${body}
        </table>
      </div>`
}

const button = (href: string, label: string) => `      <div style="text-align:center;margin:0 0 20px;">
        <a href="${esc(href)}" style="display:inline-block;background:#4b3fa0;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">${esc(label)}</a>
      </div>`

const money = (n: number) => `$${Number(n).toFixed(2)}`
// A note typed by the office, closed with a period so the next sentence reads right.
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

/* ── visit confirmation ─────────────────────────────────────────────── */

export function visitConfirmation(lang: FlowLang, v: { name: string; date: string; time: string; address?: string | null; updated?: boolean }) {
  const date = prettyDate(v.date, lang)
  const time = prettyTime(v.time)
  if (lang === 'es') {
    return {
      subject: v.updated ? `Cambio en tu visita de estimado — ${date}` : `Tu visita de estimado está confirmada — ${date}`,
      html: shell('es', [
        hello('es', v.name),
        p(v.updated ? 'Actualizamos tu visita de estimado gratuito. Estos son los datos nuevos.' : 'Tu visita de estimado gratuito está confirmada. Revisaremos el lugar y te enviaremos la cotización por escrito.'),
        summary('Tu visita', [['Fecha', esc(date)], ['Hora', esc(time)], ...(v.address ? [['Dirección', esc(v.address)] as [string, string]] : [])]),
        p(`¿Necesitas cambiar la fecha? Responde a este correo o llámanos al ${BIZ_PHONE}.`),
      ].join('\n')),
      sms: `Hola ${firstName(v.name)}, ${v.updated ? 'actualizamos' : 'te confirmamos'} tu visita de estimado gratuito con Joyful Cleaning Services el ${date} a las ${time}${v.address ? `, en ${v.address.split(',')[0]}` : ''}. ¿Necesitas cambiarla? Llámanos al ${BIZ_PHONE}.`,
    }
  }
  return {
    subject: v.updated ? `Your estimate visit has changed — ${date}` : `Your estimate visit is confirmed — ${date}`,
    html: shell('en', [
      hello('en', v.name),
      p(v.updated ? 'We updated your free estimate visit. Here are the new details.' : "Your free estimate visit is confirmed. We'll look at the space and send you a written estimate."),
      summary('Your visit', [['Date', esc(date)], ['Time', esc(time)], ...(v.address ? [['Address', esc(v.address)] as [string, string]] : [])]),
      p(`Need to reschedule? Reply to this email or call us at ${BIZ_PHONE}.`),
    ].join('\n')),
    sms: `Hi ${firstName(v.name)}, this ${v.updated ? 'updates' : 'confirms'} your free estimate visit with Joyful Cleaning Services on ${date} at ${time}${v.address ? `, at ${v.address.split(',')[0]}` : ''}. Need to reschedule? Call ${BIZ_PHONE}.`,
  }
}

/* ── the estimate itself ────────────────────────────────────────────── */

const PAYMENT = {
  en: { title: 'Payment Methods', card: 'Debit / Credit Card — 3% service fee applies', cash: 'Cash or Check accepted' },
  es: { title: 'Formas de pago', card: 'Tarjeta de débito / crédito — aplica un cargo del 3%', cash: 'Se acepta efectivo o cheque' },
}

function paymentBox(lang: FlowLang): string {
  const P = PAYMENT[lang]
  return `      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${P.title}</div>
        <div style="font-size:12px;color:#4b5563;line-height:2;">
          ${P.card}<br/>
          <strong>Zelle:</strong> @joyfulcleaningservices<br/>
          <strong>Cashapp:</strong> $Nathashasalcedo<br/>
          <strong>Venmo:</strong> @joyfulcleaningservices<br/>
          <strong>PayPal:</strong> @joyfulcleaningnc<br/>
          ${P.cash}
        </div>
      </div>`
}

export function estimateEmail(lang: FlowLang, e: { clientName: string; estimateNumber: string; total: number; validUntil: string; link: string }) {
  const valid = prettyDate(e.validUntil, lang, { month: 'long', day: 'numeric', year: 'numeric' })
  if (lang === 'es') {
    return {
      subject: `Cotización ${e.estimateNumber} — Joyful Cleaning Services`,
      html: shell('es', [
        hello('es', e.clientName),
        p(`Gracias por tu interés en Joyful Cleaning Services. Te enviamos la cotización <strong>${esc(e.estimateNumber)}</strong> por los servicios de limpieza que conversamos. El PDF va adjunto.`),
        summary('Resumen de la cotización', [['Cotización #', esc(e.estimateNumber), '#4f8ef7'], ['Válida hasta', esc(valid)], ['Total estimado', money(e.total), '#059669']]),
        button(e.link, 'Revisar y aceptar la cotización'),
        p('Desde ese enlace puedes aceptarla y elegir el día que te convenga, pedir cambios o hacernos una pregunta. <strong>¿Tienes alguna duda antes de aceptar? Solo responde a este correo con tus preguntas.</strong>'),
        paymentBox('es'),
      ].join('\n')),
    }
  }
  return {
    subject: `Estimate ${e.estimateNumber} — Joyful Cleaning Services`,
    html: shell('en', [
      hello('en', e.clientName),
      p(`Thank you for your interest in Joyful Cleaning Services. Here is estimate <strong>${esc(e.estimateNumber)}</strong> for the cleaning we discussed. The PDF is attached.`),
      summary('Estimate Summary', [['Estimate #', esc(e.estimateNumber), '#4f8ef7'], ['Valid until', esc(valid)], ['Estimated total', money(e.total), '#059669']]),
      button(e.link, 'Review & accept estimate'),
      p('From that link you can accept it and pick a day that works for you, ask for changes, or send us a question. <strong>Have any questions before accepting? Just reply to this email with them.</strong>'),
      paymentBox('en'),
    ].join('\n')),
  }
}

export function estimateSms(lang: FlowLang, e: { clientName: string; estimateNumber: string; total: number; link: string }) {
  return lang === 'es'
    ? `Hola ${firstName(e.clientName)}, gracias por recibirnos. Tu cotización ${e.estimateNumber} de Joyful Cleaning Services está lista: ${money(e.total)}. Revísala y acéptala aquí: ${e.link}\n¿Alguna pregunta? Responde este mensaje.`
    : `Hi ${firstName(e.clientName)}, thanks for having us! Your estimate ${e.estimateNumber} from Joyful Cleaning Services is ready: ${money(e.total)}. Review and accept it here: ${e.link}\nAny questions? Just reply to this text.`
}

/* ── a different date proposed by the team ──────────────────────────── */

export function proposalEmail(lang: FlowLang, e: { clientName: string; estimateNumber: string; date: string; time: string; note?: string | null; link: string }) {
  const date = prettyDate(e.date, lang)
  const time = prettyTime(e.time)
  if (lang === 'es') {
    return {
      subject: `¿Te sirve el ${date} a las ${time}?`,
      html: shell('es', [
        hello('es', e.clientName),
        p(`Gracias por aceptar la cotización <strong>${esc(e.estimateNumber)}</strong>. El día que elegiste no está disponible en nuestro calendario. ¿Podemos ir en esta fecha?`),
        summary('Fecha propuesta', [['Fecha', esc(date)], ['Hora', esc(time)], ...(e.note ? [['Nota', esc(e.note)] as [string, string]] : [])]),
        button(e.link, 'Confirmar o elegir otro día'),
        p('Si tienes alguna duda, responde a este correo.'),
      ].join('\n')),
      sms: `Hola ${firstName(e.clientName)}, ${e.note ? sentence(e.note) + ' ¿Podemos' : '¿podemos'} ir el ${date} a las ${time}? Confírmalo o elige otro día aquí: ${e.link}`,
    }
  }
  return {
    subject: `Can we come ${date} at ${time}?`,
    html: shell('en', [
      hello('en', e.clientName),
      p(`Thank you for accepting estimate <strong>${esc(e.estimateNumber)}</strong>. The day you picked isn't available on our schedule. Could we come on this date instead?`),
      summary('Proposed date', [['Date', esc(date)], ['Time', esc(time)], ...(e.note ? [['Note', esc(e.note)] as [string, string]] : [])]),
      button(e.link, 'Confirm or pick another day'),
      p('Any questions? Just reply to this email.'),
    ].join('\n')),
    sms: `Hi ${firstName(e.clientName)}, ${e.note ? sentence(e.note) + ' Could' : 'could'} we come on ${date} at ${time}? Confirm or pick another day here: ${e.link}`,
  }
}
