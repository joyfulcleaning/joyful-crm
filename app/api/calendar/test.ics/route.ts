export const dynamic = 'force-dynamic'

export async function GET() {
  const events = [
    {
      uid:         'test-svc-001@joyfulcleaning.com',
      dtstart:     '20260615T090000',
      dtend:       '20260615T110000',
      summary:     'Standard Clean – Southern Pines Reserve',
      description: 'Type: Standard Clean\\nClient: Southern Pines Reserve\\nUnit: 5804 | Room: 1BR\\nStaff: Maria, Jose\\nStatus: Scheduled',
      location:    '1234 Pine St, Raleigh, NC 27601',
    },
    {
      uid:         'test-svc-002@joyfulcleaning.com',
      dtstart:     '20260616T100000',
      dtend:       '20260616T130000',
      summary:     'Deep Clean – The One at Fayetteville',
      description: 'Type: Deep Clean\\nClient: The One at Fayetteville\\nUnit: 602 | Room: Modelo\\nStaff: Ana\\nStatus: Scheduled',
      location:    '5678 Fayetteville Rd, Durham, NC 27703',
    },
    {
      uid:         'test-svc-003@joyfulcleaning.com',
      dtstart:     '20260617T080000',
      dtend:       '20260617T100000',
      summary:     'Standard Clean – Jamestown',
      description: 'Type: Standard Clean\\nClient: Jamestown\\nUnit: 307 | Room: 3BR\\nStaff: Maria\\nStatus: Scheduled',
      location:    '910 Jamestown Pkwy, Greensboro, NC 27410',
    },
    {
      uid:         'test-svc-004@joyfulcleaning.com',
      dtstart:     '20260618T140000',
      dtend:       '20260618T160000',
      summary:     'Move In/Out – Eagle Landing',
      description: 'Type: Move In/Out\\nClient: Eagle Landing\\nUnit: 101 | Room: 2BR\\nStaff: Jose, Ana\\nStatus: Scheduled',
      location:    '321 Eagle Dr, Cary, NC 27513',
    },
    {
      uid:         'test-svc-005@joyfulcleaning.com',
      dtstart:     '20260619T090000',
      dtend:       '20260619T120000',
      summary:     'Heavy Deep Clean – Franklin Cleaning',
      description: 'Type: Heavy Deep Clean\\nClient: Franklin Cleaning\\nUnit: Office/Amenities\\nStaff: Maria, Jose, Ana\\nStatus: Scheduled',
      location:    '456 Franklin Ave, Chapel Hill, NC 27514',
    },
  ]

  const vevents = events.map(e => [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTART;TZID=America/New_York:${e.dtstart}`,
    `DTEND;TZID=America/New_York:${e.dtend}`,
    `SUMMARY:${e.summary}`,
    `DESCRIPTION:${e.description}`,
    `LOCATION:${e.location}`,
    'STATUS:CONFIRMED',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Joyful Cleaning Services//Calendar Test//EN',
    'X-WR-CALNAME:Joyful Services (TEST)',
    'X-WR-TIMEZONE:America/New_York',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ics, {
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="joyful-test.ics"',
      'Cache-Control':       'no-cache',
    },
  })
}
