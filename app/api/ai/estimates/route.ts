export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { isAiAuthorized } from '@/lib/ai-auth'
import { normalizePhone } from '@/lib/phone'
import { calcSqftEstimate, SQFT_RATES } from '@/lib/pricing'
import { generateEstimatePDF, buildEmailHtml, type EstimateData } from '@/lib/estimate-pdf'

// POST /api/ai/estimates
// Calculates a post-construction estimate from SQFT and emails the PDF to
// the client — the price is never returned to the caller (AI), only a
// confirmation that it was sent. Reuses the same PDF/email pipeline as the
// dashboard's "Send Estimate" action.
export async function POST(request: Request) {
  if (!isAiAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, phone, email, address, sqft, type, notes, clientId } = body

    if (!name || !email || !address || !sqft || !type) {
      return NextResponse.json({ error: 'name, email, address, sqft and type are required' }, { status: 400 })
    }
    const total = calcSqftEstimate(type, Number(sqft))
    if (total == null) {
      return NextResponse.json({ error: `type must be one of: ${Object.keys(SQFT_RATES).join(', ')}` }, { status: 400 })
    }

    let resolvedClientId: string | null = clientId || null
    if (!resolvedClientId && phone) {
      const target = normalizePhone(phone)
      const candidates = await prisma.client.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })
      resolvedClientId = candidates.find(c => c.phone && normalizePhone(c.phone) === target)?.id ?? null
    }

    const year = new Date().getFullYear()
    const count = await prisma.estimate.count()
    const estimateNumber = `EST-${year}-${String(count + 1).padStart(3, '0')}`

    const issueDate = new Date()
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const estimateData: EstimateData = {
      estimateNumber,
      issueDate: issueDate.toISOString(),
      validUntil: validUntil.toISOString(),
      clientName: name,
      clientEmail: email,
      clientPhone: phone || '',
      clientAddress: address,
      notes: notes || '',
      taxRate: 0,
      items: [{ description: `${type} — ${sqft} sqft`, qty: 1, unitPrice: total, total }],
      subtotal: total,
      tax: 0,
      total,
    }

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        issueDate,
        validUntil,
        clientName: name,
        clientEmail: email,
        clientPhone: phone || null,
        clientAddress: address,
        notes: notes || null,
        taxRate: 0,
        subtotal: total,
        tax: 0,
        total,
        items: estimateData.items,
        clientId: resolvedClientId,
      },
    })

    let emailSent = false
    try {
      const [pdfBuffer, emailHtml] = await Promise.all([
        generateEstimatePDF(estimateData),
        Promise.resolve(buildEmailHtml(estimateData)),
      ])
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      })
      await transporter.sendMail({
        from: `"Joyful Cleaning Services Corp." <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Estimate ${estimateNumber} | Joyful Cleaning Services Corp.`,
        html: emailHtml,
        attachments: [{ filename: `Estimate-${estimateNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
      })
      emailSent = true
      await prisma.estimate.update({ where: { id: estimate.id }, data: { emailSentAt: new Date() } })
    } catch (emailError) {
      console.error('Error sending AI estimate email:', emailError)
    }

    return NextResponse.json({
      success: true,
      estimateId: estimate.id,
      estimateNumber,
      emailSent,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/ai/estimates:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Estimate number already exists, try again' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 })
  }
}
