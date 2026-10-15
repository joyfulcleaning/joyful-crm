/**
 * Client-facing emails about a service's schedule: the confirmation sent when
 * it's booked, and the reminder sent the day before.
 *
 * Both carry only the schedule — service number, type, date and time. No
 * price, no address, no staff names, so the email stays correct after the
 * office reprices the job or reassigns the crew.
 */

// serviceDate is a `@db.Date`, so its Date lands at midnight UTC — formatting
// that in a timezone west of UTC prints the day before. Pinning to midday is
// what the invoice templates do for the same reason.
export function formatServiceDate(value: Date | string): string {
  const iso = typeof value === 'string' ? value : value.toISOString()
  return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function formatServiceTime(time: string | null | undefined): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export type ScheduleRow = {
  serviceNumber: number
  serviceDate:   Date | string
  serviceTime:   string | null
  type:          string
}

// Branded shell shared with the invoice emails, so everything the client gets
// from us looks like it came from the same company.
function shell(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
</head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#4b3fa0;padding:28px 32px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:#ffffff;">Joyful Cleaning Services</div>
    </div>
    <div style="padding:32px;">
${inner}
      <p style="font-size:13px;color:#374151;margin-top:20px;">
        Warm regards,<br/>
        <strong>Joyful Cleaning Services Team</strong><br/>
        <span style="color:#6b7280">(919) 322-9092 · joyfulcleaningservicescorp@gmail.com</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">
        Joyful Cleaning Services · 320 Laketree Blvd, Spring Lake NC 28390<br/>
        joyfulcleaningservicesnc.com · joyfulcleaningservicescorp@gmail.com
      </div>
    </div>
  </div>
</body>
</html>`
}

function scheduleTable(title: string, rows: ScheduleRow[]): string {
  const body = rows.map(r => {
    const time = formatServiceTime(r.serviceTime)
    return `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 0;color:#4b5563;">
              <strong style="color:#111827">${formatServiceDate(r.serviceDate)}</strong>
              ${time ? `<br/><span style="font-size:12px;color:#6b7280">${escapeHtml(time)}</span>` : ''}
            </td>
            <td style="padding:8px 0;text-align:right;">
              <strong style="color:#111827">${escapeHtml(r.type)}</strong>
              <br/><span style="font-size:12px;color:#4f8ef7;font-family:monospace">#${r.serviceNumber}</span>
            </td>
          </tr>`
  }).join('')

  return `      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${title}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${body}
        </table>
      </div>`
}

export function confirmationSubject(rows: ScheduleRow[]): string {
  return rows.length > 1
    ? `Services confirmed — ${rows.length} cleanings starting ${formatServiceDate(rows[0].serviceDate)}`
    : `Service confirmed — #${rows[0].serviceNumber} on ${formatServiceDate(rows[0].serviceDate)}`
}

export function confirmationHtml(clientName: string, rows: ScheduleRow[]): string {
  const isSeries = rows.length > 1
  return shell(`      <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:16px;">Dear ${escapeHtml(clientName)},</p>
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px;">
        Thank you for choosing <strong>Joyful Cleaning Services</strong>.
        ${isSeries
          ? `Your <strong>${rows.length} cleaning services</strong> are confirmed and on our schedule.`
          : `Your cleaning service is confirmed and on our schedule.`}
      </p>
${scheduleTable(isSeries ? 'Scheduled Services' : 'Service Details', rows)}
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px;">
        If you need to reschedule or anything about ${isSeries ? 'these dates' : 'this date'} doesn't look right,
        just reply to this email or give us a call and we'll take care of it.
      </p>
      <p style="font-size:13px;color:#374151;line-height:1.7;">
        We look forward to serving you.
      </p>`)
}

export function reminderSubject(row: ScheduleRow): string {
  const time = formatServiceTime(row.serviceTime)
  return `Reminder — your cleaning is tomorrow${time ? ` at ${time}` : ''}`
}

export function reminderHtml(clientName: string, row: ScheduleRow): string {
  const time = formatServiceTime(row.serviceTime)
  return shell(`      <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:16px;">Dear ${escapeHtml(clientName)},</p>
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px;">
        This is a friendly reminder that your cleaning service with
        <strong>Joyful Cleaning Services</strong> is scheduled for
        <strong>tomorrow${time ? ` at ${escapeHtml(time)}` : ''}</strong>.
      </p>
${scheduleTable('Your Appointment', [row])}
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px;">
        Please make sure our team can get in, and let us know as soon as possible
        if you need to reschedule — just reply to this email or give us a call.
      </p>
      <p style="font-size:13px;color:#374151;line-height:1.7;">
        We look forward to seeing you tomorrow.
      </p>`)
}
