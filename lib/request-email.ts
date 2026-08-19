// Customer-facing email for an inbound request (website quote or AI phone
// assistant). Staff writes the message in the app; this wraps it in the same
// branded shell the invoice email uses and appends a recap of what the
// customer actually asked for.

type Row = { label: string; value: string }

const COPY = {
  en: {
    subject: (type: string) => `${type} — Joyful Cleaning Services`,
    greeting: (name: string) => `Dear ${name},`,
    recapTitle: 'Your request',
    requestNo: 'Request #',
    regards: 'Warm regards,',
    team: 'Joyful Cleaning Services Team',
    rows: {
      address: 'Address',
      service: 'Service requested',
      preferredDate: 'Preferred date',
      date: 'Date',
      sqft: 'Square feet',
      unit: 'Unit',
      roomSize: 'Size',
      notes: 'What you told us',
    },
  },
  es: {
    subject: (type: string) => `${type} — Joyful Cleaning Services`,
    greeting: (name: string) => `Estimado/a ${name}:`,
    recapTitle: 'Tu solicitud',
    requestNo: 'Solicitud #',
    regards: 'Un cordial saludo,',
    team: 'Equipo de Joyful Cleaning Services',
    rows: {
      address: 'Dirección',
      service: 'Servicio solicitado',
      preferredDate: 'Fecha preferida',
      date: 'Fecha',
      sqft: 'Pies cuadrados',
      unit: 'Unidad',
      roomSize: 'Tamaño',
      notes: 'Lo que nos comentaste',
    },
  },
}

export type EmailLang = keyof typeof COPY

export function langOf(locale?: string | null): EmailLang {
  return (locale || '').toLowerCase().startsWith('es') ? 'es' : 'en'
}

// Everything here can come from a public website form, so it all gets escaped.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function prettyDate(v: unknown, lang: EmailLang): string {
  const str = String(v ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return new Date(`${str}T12:00:00Z`).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function composeAddress(street?: unknown, city?: unknown, state?: unknown, zip?: unknown): string {
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [street, cityStateZip].filter(Boolean).join(', ')
}

// Only what the customer themselves provided. Internal fields — estimated
// price (explicitly never quoted to the caller), service ids, isNewClient,
// the follow-up reason and the narrative summary — must never appear here.
// `summary` is passed in only to be filtered OUT: requestService() and
// requestEstimateVisit() default payload.notes to that internal narrative
// ("We received a call from…"), which would read absurdly to the customer.
export function customerFacingRows(type: string, payload: any, lang: EmailLang, summary?: string | null): Row[] {
  const L = COPY[lang].rows
  const p = payload || {}
  const rows: Row[] = []
  const push = (label: string, value: unknown) => {
    const str = String(value ?? '').trim()
    if (str) rows.push({ label, value: str })
  }
  const dateTime = (date: unknown, time: unknown) => [prettyDate(date, lang), time].filter(Boolean).join(' · ')

  switch (type) {
    case 'quote_request':
      push(L.address, composeAddress(p.address, p.city))
      push(L.service, p.serviceNeeded)
      push(L.preferredDate, prettyDate(p.preferredDate, lang))
      break
    case 'schedule_service':
      push(L.address, p.address || composeAddress(p.street, p.city, p.state, p.zip))
      push(L.unit, p.unit)
      push(L.service, p.type)
      push(L.date, dateTime(p.serviceDate, p.serviceTime))
      push(L.roomSize, p.roomSize)
      break
    case 'reschedule_or_cancel_service':
      push(L.date, dateTime(p.serviceDate, p.serviceTime))
      break
    case 'create_sqft_estimate':
      push(L.address, p.address)
      push(L.service, p.type)
      push(L.sqft, p.sqft)
      break
    case 'schedule_estimate_visit':
      push(L.address, p.address || composeAddress(p.street, p.city, p.state, p.zip))
      push(L.date, dateTime(p.visitDate, p.visitTime))
      break
    case 'needs_followup':
      push(L.address, composeAddress(p.address, p.city, p.state, p.zip))
      push(L.unit, p.unit)
      push(L.service, p.serviceType)
      push(L.date, dateTime(p.serviceDate, p.serviceTime))
      push(L.date, dateTime(p.visitDate, p.visitTime))
      push(L.roomSize, p.roomSize)
      push(L.sqft, p.sqft)
      break
  }
  const notes = String(p.notes ?? '').trim()
  if (notes && notes !== String(summary ?? '').trim()) push(L.notes, notes)
  return rows
}

export function requestEmailSubject(typeLabel: string, lang: EmailLang): string {
  return COPY[lang].subject(typeLabel)
}

export function buildRequestEmailHtml(args: {
  customerName?: string | null
  message: string
  rows: Row[]
  requestCode: string
  lang: EmailLang
}): string {
  const { customerName, message, rows, requestCode, lang } = args
  const C = COPY[lang]

  const paragraphs = message
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 16px;">${esc(block).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  const rowsHtml = rows.map((r, i) => `
          <tr${i < rows.length - 1 ? ' style="border-bottom:1px solid #f3f4f6;"' : ''}>
            <td style="padding:6px 0;color:#4b5563;vertical-align:top;">${esc(r.label)}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">${esc(r.value)}</td>
          </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
</head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#4b3fa0;padding:28px 32px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:#ffffff;">Joyful Cleaning Services</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 16px;">${esc(C.greeting(customerName || (lang === 'es' ? 'cliente' : 'customer')))}</p>
      ${paragraphs}
      ${rows.length > 0 ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:24px 0;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${esc(C.recapTitle)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:6px 0;color:#4b5563;">${esc(C.requestNo)}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#4f8ef7;font-family:monospace">${esc(requestCode)}</td>
          </tr>${rowsHtml}
        </table>
      </div>` : ''}
      <p style="font-size:13px;color:#374151;margin-top:20px;">
        ${esc(C.regards)}<br/>
        <strong>${esc(C.team)}</strong><br/>
        <span style="color:#6b7280">(919) 322-9092 · joyfulcleaningservicescorp@gmail.com</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">
        Joyful Cleaning Services · 320 Laketree Blvd, Spring Lake NC 28390<br/>
        joyfulcleaningservicesnc.com · joyfulcleaningservicescorp@gmail.com
      </div>
    </div>
  </div>
</body>
</html>`
}
