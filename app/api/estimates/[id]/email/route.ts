export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { generateEstimatePDF, buildEmailHtml, EstimateData } from '@/lib/estimate-pdf'
import { getAuthUser } from '@/lib/mobile-auth'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const est = await prisma.estimate.findUnique({ where: { id } })
    if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!est.clientEmail) return NextResponse.json({ error: 'No email on this estimate' }, { status: 400 })

    const rawItems = Array.isArray(est.items) ? est.items as any[] : []
    const items = rawItems.map((it: any) => ({
      description: it.description ?? '',
      qty:         Number(it.qty ?? 1),
      unitPrice:   Number(it.unitPrice ?? it.unit_price ?? 0),
      total:       Number(it.total ?? (Number(it.qty ?? 1) * Number(it.unitPrice ?? it.unit_price ?? 0))),
    }))

    const data: EstimateData = {
      estimateNumber: est.estimateNumber,
      issueDate:      est.issueDate?.toISOString() ?? '',
      validUntil:     est.validUntil?.toISOString() ?? '',
      clientName:     est.clientName ?? '',
      clientEmail:    est.clientEmail,
      clientPhone:    est.clientPhone ?? '',
      clientAddress:  est.clientAddress ?? '',
      notes:          est.notes ?? '',
      taxRate:        Number(est.taxRate),
      subtotal:       Number(est.subtotal),
      tax:            Number(est.tax),
      total:          Number(est.total),
      items,
    }

    const [pdfBuffer, emailHtml] = await Promise.all([
      generateEstimatePDF(data),
      Promise.resolve(buildEmailHtml(data)),
    ])

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })

    await transporter.sendMail({
      from:        `"Joyful Cleaning Services" <${process.env.GMAIL_USER}>`,
      to:          est.clientEmail,
      subject:     `Estimate ${est.estimateNumber} — Joyful Cleaning Services`,
      html:        emailHtml,
      attachments: [{ filename: `Estimate-${est.estimateNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    })

    await prisma.estimate.update({ where: { id }, data: { emailSentAt: new Date() } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/estimates/[id]/email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
