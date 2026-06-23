// Hourly slot grid used by the AI phone assistant to schedule services (one crew per hour).
export const HOURLY_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

export function nowInEastern() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}
