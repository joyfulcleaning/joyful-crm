import { prisma } from './prisma'
import { notifyEvent } from './notify-admin'

const BUSINESS_TIMEZONE = 'America/New_York'

// dueDate (@db.Date) is stored as UTC midnight of its calendar day. An
// invoice becomes overdue the day AFTER that date, so the cutoff must be
// UTC midnight of today's business-calendar date — not `new Date()` with
// setHours(0,0,0,0), which anchors to the server's local midnight and can
// flag an invoice overdue on its actual due date (see date-range-timezone-bug).
function todayMidnightUTC(): Date {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
  return new Date(`${ymd}T00:00:00.000Z`)
}

// Flips `sent` invoices past their dueDate to `overdue` and fires a push/
// email notification for each one that just transitioned. Called both from
// GET /api/invoices (so the status stays fresh whenever anyone opens the
// list) and from the daily cron (so it fires even if nobody opens the app).
export async function transitionOverdueInvoices() {
  const overdue = await prisma.invoice.findMany({
    where: { status: 'sent', dueDate: { lt: todayMidnightUTC(), not: null } },
    select: { id: true, invoiceNumber: true, total: true, client: { select: { name: true } } },
  })
  if (overdue.length === 0) return { transitioned: 0 }

  await prisma.invoice.updateMany({
    where: { id: { in: overdue.map(i => i.id) } },
    data: { status: 'overdue' },
  })

  for (const inv of overdue) {
    const money = Number(inv.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    const clientName = inv.client?.name ?? 'client'
    notifyEvent('overdue', {
      pushTitle: 'Invoice overdue',
      pushBody: `${inv.invoiceNumber} (${clientName}) — ${money} is now past due`,
      pushData: { type: 'invoiceOverdue', invoiceId: inv.id },
      emailSubject: `Invoice overdue — ${inv.invoiceNumber}`,
      emailHtml: `
        <p>An invoice has passed its due date and is now overdue.</p>
        <ul>
          <li><strong>Invoice:</strong> ${inv.invoiceNumber}</li>
          <li><strong>Client:</strong> ${clientName}</li>
          <li><strong>Amount:</strong> ${money}</li>
        </ul>
      `,
    }).catch(err => console.error('Error notifying invoice overdue:', err))
  }

  return { transitioned: overdue.length }
}
