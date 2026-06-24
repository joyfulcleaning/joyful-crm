// Hourly slot grid used by the AI phone assistant to schedule services (one crew per hour).
export const HOURLY_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

// Monday-Friday only (0=Sunday..6=Saturday). Enforced here so the LLM never
// has to recall/guess this — it was inconsistent across calls when it was
// only stated in the prompt.
export const WORKING_DAYS = [1, 2, 3, 4, 5]

export function isWorkingDay(dateStr: string): boolean {
  return WORKING_DAYS.includes(new Date(`${dateStr}T12:00:00Z`).getUTCDay())
}

export function nowInEastern() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}
