import { prisma } from './prisma'
import { notifyEvent } from './notify-admin'
import { sendPushToRoles } from './push'
import { sendPlainEmail } from './email'
import { escapeHtml as esc } from './service-emails'
import { DayWindow, WINDOW_LABEL, prettyDate, prettyTime } from './estimate-flow'

// Tells the office what a client just did on their estimate link. Internal
// notifications are in English like every other one the app sends.

type Est = { id: string; estimateNumber: string; clientName: string; clientEmail: string | null; clientPhone: string | null; total: unknown }

export type ClientAction =
  | { kind: 'accepted'; date: string; window: DayWindow; note?: string | null }
  | { kind: 'changes'; note: string }
  | { kind: 'declined'; reason?: string | null; note?: string | null }
  | { kind: 'question'; note: string }
  | { kind: 'confirmed'; date: string; time: string }
  | { kind: 'suggested'; date: string; window: DayWindow; note?: string | null }

const day = (d: string) => prettyDate(d, 'en', { weekday: 'short', month: 'short', day: 'numeric' })

function describe(est: Est, a: ClientAction): { title: string; body: string } {
  const who = est.clientName
  const n = est.estimateNumber
  switch (a.kind) {
    case 'accepted':  return { title: `${who} accepted ${n}`, body: `$${Number(est.total).toFixed(2)} · asks for ${day(a.date)}, ${WINDOW_LABEL.en[a.window].toLowerCase()}` }
    case 'changes':   return { title: `${who} asked for changes to ${n}`, body: a.note }
    case 'declined':  return { title: `${who} declined ${n}`, body: [a.reason, a.note].filter(Boolean).join(' · ') || 'No reason given' }
    case 'question':  return { title: `${who} has a question about ${n}`, body: a.note }
    case 'confirmed': return { title: `${who} confirmed the date`, body: `${day(a.date)} at ${prettyTime(a.time)} · ready to schedule` }
    case 'suggested': return { title: `${who} suggested another day`, body: `${day(a.date)}, ${WINDOW_LABEL.en[a.window].toLowerCase()}${a.note ? ` · ${a.note}` : ''}` }
  }
}

export async function notifyEstimateAction(est: Est, visitId: string | null, action: ClientAction) {
  const { title, body } = describe(est, action)
  const contact = [est.clientEmail, est.clientPhone].filter(Boolean).map(v => esc(String(v))).join(' · ')
  const html = `
    <p><strong>${esc(title)}</strong></p>
    <p>${esc(body).replace(/\n/g, '<br/>')}</p>
    ${contact ? `<p>Client: ${esc(est.clientName)} · ${contact}</p>` : ''}
    <p style="color:#6b7280">Open the estimate visit in the Joyful CRM app to answer.</p>`

  // A question needs an answer, so it always reaches the office inbox, with
  // Reply-To set to the client: replying from Gmail answers them directly.
  if (action.kind === 'question') {
    await sendPushToRoles('estimateResponse', title, body, { type: 'estimateResponse', estimateId: est.id, visitId })
    try {
      const to = (await prisma.setting.findUnique({ where: { key: 'biz.email' } }))?.value || process.env.GMAIL_USER
      if (to) await sendPlainEmail(to, `Question about ${est.estimateNumber} from ${est.clientName}`, html, est.clientEmail ? { replyTo: est.clientEmail } : {})
    } catch (err) {
      console.error('Error emailing estimate question to the office:', err)
    }
    return
  }

  await notifyEvent('estimateResponse', {
    pushTitle: title,
    pushBody: body,
    pushData: { type: 'estimateResponse', estimateId: est.id, visitId },
    emailSubject: title,
    emailHtml: html,
  })
}
