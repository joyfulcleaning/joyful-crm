export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { generateEstimatePDF, buildEmailHtml, EstimateData } from '@/lib/estimate-pdf'

export async function POST(req: Request) {
  try {
    const estimate: EstimateData = await req.json()

    if (!estimate.clientEmail) {
      return NextResponse.json({ error: 'Client email is required' }, { status: 400 })
    }

    const [pdfBuffer, emailHtml] = await Promise.all([
      generateEstimatePDF(estimate),
      Promise.resolve(buildEmailHtml(estimate)),
    ])

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })

    await transporter.sendMail({
      from:        `"Joyful Cleaning Services" <${process.env.GMAIL_USER}>`,
      to:          estimate.clientEmail,
      subject:     `Estimate ${estimate.estimateNumber} — Joyful Cleaning Services`,
      html:        emailHtml,
      attachments: [{
        filename:    `Estimate-${estimate.estimateNumber}.pdf`,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Estimate email error:', error)
    return NextResponse.json({ error: 'Failed to send estimate email' }, { status: 500 })
  }
}
