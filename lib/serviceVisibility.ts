const TIMEZONE = 'America/New_York'

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
  }
}

/**
 * Dates (as YYYY-MM-DD, in America/New_York) visible to a "user" role staff member.
 * Always includes today. Tomorrow is added once it's 6 PM or later (Eastern time).
 */
export function getVisibleServiceDates(now: Date = new Date()): string[] {
  const { year, month, day, hour } = localDateParts(now)

  const today = new Date(Date.UTC(year, month - 1, day))
  const dates = [today]

  if (hour >= 18) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
    dates.push(tomorrow)
  }

  return dates.map(d => d.toISOString().slice(0, 10))
}

const PRICE_FIELDS = ['basePrice', 'additionalFee', 'total'] as const

export function stripPriceFields<T extends Record<string, any>>(service: T): T {
  const stripped: Record<string, any> = { ...service }
  for (const field of PRICE_FIELDS) delete stripped[field]
  if (Array.isArray(stripped.duplicates)) {
    stripped.duplicates = stripped.duplicates.map((d: any) => stripPriceFields(d))
  }
  return stripped as T
}
