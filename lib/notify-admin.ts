import { prisma } from './prisma'
import { sendPushToRoles } from './push'

// Fires both channels for a Settings → Notifications event: push (via
// sendPushToRoles, respecting notif.{eventKey}.push/.roles) and email (to
// the company's Primary Email — Settings → Business → biz.email — gated by
// the base notif.{eventKey} toggle). Mirrors the existing aiRequest
// push-only pattern but adds the email leg those toggles were already
// labeled for in the UI. All company notifications share one address by
// design; there is no separate per-notification email setting.
export async function notifyEvent(eventKey: string, opts: {
  pushTitle: string
  pushBody: string
  pushData?: Record<string, any>
  emailSubject: string
  emailHtml: string
}) {
  await sendPushToRoles(eventKey, opts.pushTitle, opts.pushBody, opts.pushData)

  try {
    const [emailSetting, toSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: `notif.${eventKey}` } }),
      prisma.setting.findUnique({ where: { key: 'biz.email' } }),
    ])
    if (emailSetting?.value !== 'true') return
    const to = toSetting?.value
    if (!to) return

    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    await transporter.sendMail({
      from:    `"Joyful Cleaning Services" <${process.env.GMAIL_USER}>`,
      to,
      subject: opts.emailSubject,
      html:    opts.emailHtml,
    })
  } catch (err) {
    console.error(`Error sending notification email for event "${eventKey}":`, err)
  }
}
