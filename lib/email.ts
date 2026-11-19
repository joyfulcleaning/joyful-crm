import nodemailer from 'nodemailer'

export type EmailExtras = {
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
  // Where a reply goes when it shouldn't be our own inbox — e.g. a client's
  // question forwarded to the office, so hitting Reply answers the client.
  replyTo?: string
}

export async function sendPlainEmail(to: string, subject: string, html: string, extras: EmailExtras = {}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: `"Joyful Cleaning Services Corp." <${process.env.GMAIL_USER}>`,
    to, subject, html,
    ...(extras.replyTo ? { replyTo: extras.replyTo } : {}),
    ...(extras.attachments ? { attachments: extras.attachments } : {}),
  })
}
