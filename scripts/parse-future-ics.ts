import fs from 'fs'

const raw = fs.readFileSync('joyful_eventos_futuros_clean.ics', 'utf8')
const lines = raw.split(/\r?\n/)

type Ev = {
  uid: string
  summary: string
  location: string
  dtstart: string
  dtend: string
  dtstartIsDateOnly: boolean
  rrule: string | null
  recurrenceId: string | null
  exdate: string | null
  sequence: string | null
}

const events: Ev[] = []
let cur: Partial<Ev> | null = null

for (const line of lines) {
  if (line === 'BEGIN:VEVENT') { cur = {}; continue }
  if (line === 'END:VEVENT') { if (cur) events.push(cur as Ev); cur = null; continue }
  if (!cur) continue
  if (line.startsWith('UID:')) cur.uid = line.slice(4)
  else if (line.startsWith('SUMMARY:')) cur.summary = line.slice(8).trim()
  else if (line.startsWith('LOCATION:')) cur.location = line.slice(9)
  else if (line.startsWith('DTSTART')) {
    const isDateOnly = line.includes('VALUE=DATE:')
    const val = line.split(':').pop()!
    cur.dtstart = val
    cur.dtstartIsDateOnly = isDateOnly
  }
  else if (line.startsWith('DTEND')) {
    const val = line.split(':').pop()!
    cur.dtend = val
  }
  else if (line.startsWith('RRULE:')) cur.rrule = line.slice(6)
  else if (line.startsWith('RECURRENCE-ID')) cur.recurrenceId = line.split(':').pop()!
  else if (line.startsWith('EXDATE')) cur.exdate = line.split(':').pop()!
  else if (line.startsWith('SEQUENCE:')) cur.sequence = line.slice(9)
}

function parseLocalDateTime(val: string, isDateOnly: boolean) {
  // val like 20260629T130000 or 20260629
  const y = val.slice(0, 4), mo = val.slice(4, 6), d = val.slice(6, 8)
  if (isDateOnly) return { date: `${y}-${mo}-${d}`, time: null }
  const hh = val.slice(9, 11), mm = val.slice(11, 13)
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mm}` }
}

const CUTOFF = '2026-06-29'

const parsed = events.map(e => {
  const { date, time } = parseLocalDateTime(e.dtstart, e.dtstartIsDateOnly)
  return { ...e, date, time }
})

console.log(`Total events in file: ${events.length}`)

const future = parsed.filter(e => e.date >= CUTOFF && !e.rrule)
const recurringMasters = parsed.filter(e => e.rrule)
const beforeCutoff = parsed.filter(e => e.date < CUTOFF && !e.rrule)

console.log(`\n=== Events with DTSTART >= ${CUTOFF} (no RRULE): ${future.length} ===`)
for (const e of future.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
  console.log(`${e.date} ${e.time ?? '(all-day)'}  | ${e.location?.replace(/\\n/g, ', ').replace(/\\,/g, ',')}  | ${e.summary}  | uid=${e.uid}${e.recurrenceId ? '  [RECURRENCE-ID]' : ''}`)
}

console.log(`\n=== Recurring MASTER events (RRULE) — need manual decision: ${recurringMasters.length} ===`)
for (const e of recurringMasters) {
  console.log(`${e.date} ${e.time ?? '(all-day)'}  | ${e.location?.replace(/\\n/g, ', ')}  | ${e.summary}  | RRULE=${e.rrule}  | EXDATE=${e.exdate ?? '-'}  | uid=${e.uid}`)
}

console.log(`\n=== Events before cutoff (${beforeCutoff.length}) — IGNORED per instructions ===`)

// distinct locations among future events
const locs = new Set(future.map(e => e.location))
console.log(`\n=== Distinct locations among future events (${locs.size}) ===`)
for (const l of locs) console.log(' -', l?.replace(/\\n/g, ', ').replace(/\\,/g, ','))
