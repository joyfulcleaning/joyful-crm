import nodemailer from 'nodemailer'

export async function sendPlainEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: `"Joyful Cleaning Services Corp." <${process.env.GMAIL_USER}>`,
    to, subject, html,
  })
}
