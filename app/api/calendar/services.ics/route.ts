export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

const TYPE_ABBR: Record<string, string> = {
  'Standard Clean':      'SC',
  'Deep Clean':          'DC',
  'Heavy Deep Clean':    'HDC',
  'Office Clean':        'OC',
  'Move In/Out':         'MIO',
  'Touch Up':            'TU',
  'Construction Clean':  'CC',
  'Airbnb Clean':        'ABC',
  'Cancellation Fee':    'CF',
  'Inspection Fee':      'IF',
  'Monthly Cleaning':    'MC',
  'Biweekly Cleaning':   'BWC',
  'Weekly Cleaning':     'WC',
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

function timeToIcs(t: string) {
  return t.replace(':', '') + '00'
}

function endTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const end = (h + 2) % 24
  return String(end).padStart(2, '0') + String(m).padStart(2, '0') + '00'
}

function dateToIcs(d: Date) {
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

function escape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET() {
  const services = await prisma.service.findMany({
    where:   { status: { not: 'cancelled' } },
    include: {
      client: { select: { name: true, address: true, city: true, state: true, zip: true } },
      staff:  { include: { user: { select: { name: true } } } },
    },
    orderBy: { serviceDate: 'asc' },
  })

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const vevents = services.map(s => {
    const dateStr    = dateToIcs(s.serviceDate)
    const hasTime    = !!s.serviceTime
    const abbr       = TYPE_ABBR[s.type] ?? s.type
    const staffNames = s.staff.map(st => st.user?.name?.split(' ')[0]).filter(Boolean).join(', ') || 'Unassigned'

    // Title: Unit · Room · SC  (omit missing parts)
    const titleParts = [s.unit, s.roomSize, abbr].filter(Boolean)
    const summary    = titleParts.join(' · ')

    // Address parts for Maps
    const addressParts = [
      s.address || s.client.address,
      s.client.city,
      s.client.state,
      s.client.zip,
    ].filter(Boolean)
    const address = addressParts.join(', ')

    // LOCATION = "Client Name, Address" → shows as 2nd line in month preview + opens Maps
    const location = [s.client.name, address].filter(Boolean).join(', ')

    // Description: real \n so escape() converts them correctly to ICS line breaks
    const unitRoom = [s.unit ? `Unit: ${s.unit}` : null, s.roomSize ? `Room: ${s.roomSize}` : null].filter(Boolean).join(' | ')
    const descLines = [
      `Client: ${s.client.name}`,
      `Type: ${s.type}`,
      unitRoom || null,
      `Status: ${STATUS_LABEL[s.status] ?? s.status}`,
      s.internalNotes ? `Note For Staff: ${s.internalNotes}` : null,
    ].filter(Boolean).join('\n')

    const parts: string[] = []
    parts.push('BEGIN:VEVENT')
    parts.push(`UID:svc-${s.id}@joyfulcleaning.com`)
    parts.push(`DTSTAMP:${now}`)
    parts.push(`SUMMARY:${escape(summary)}`)
    parts.push(`DESCRIPTION:${escape(descLines)}`)
    if (location) parts.push(`LOCATION:${escape(location)}`)

    if (hasTime) {
      parts.push(`DTSTART;TZID=America/New_York:${dateStr}T${timeToIcs(s.serviceTime)}`)
      parts.push(`DTEND;TZID=America/New_York:${dateStr}T${endTime(s.serviceTime)}`)
    } else {
      parts.push(`DTSTART;VALUE=DATE:${dateStr}`)
      parts.push(`DTEND;VALUE=DATE:${dateStr}`)
    }

    const icsStatus = s.status === 'completed' || s.status === 'in_progress' ? 'CONFIRMED' : 'TENTATIVE'
    parts.push(`STATUS:${icsStatus}`)
    parts.push('END:VEVENT')

    return parts.join('\r\n')
  })

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Joyful Cleaning Services Corp.//Services Calendar//EN',
    'X-WR-CALNAME:Joyful Cleaning – Services',
    'X-WR-TIMEZONE:America/New_York',
    'X-WR-CALDESC:All scheduled services for Joyful Cleaning Services Corp.',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ics, {
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="joyful-services.ics"',
      'Cache-Control':       'no-cache, no-store',
    },
  })
}
