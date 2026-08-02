export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { transitionOverdueInvoices } from '@/lib/invoice-overdue'

// Runs daily so overdue invoices get flagged (and notified) even if nobody
// opens the invoices list that day — GET /api/invoices runs the same
// transition inline, but only when someone loads the page.
// Vercel Cron calls GET — protected by CRON_SECRET in production
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await transitionOverdueInvoices()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Cron mark-overdue-invoices:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
