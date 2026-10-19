export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { transitionOverdueInvoices } from '@/lib/invoice-overdue'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'

// Runs daily so overdue invoices get flagged (and notified) even if nobody
// opens the invoices list that day — GET /api/invoices runs the same
// transition inline, but only when someone loads the page.
// Vercel Cron calls GET — protected by CRON_SECRET in production
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request, 'mark-overdue-invoices')
  if (rejected) return rejected
  try {
    const result = await transitionOverdueInvoices()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Cron mark-overdue-invoices:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
