import { prisma } from './prisma'

const TIMEZONE = 'America/New_York'

function localDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')) }
}

function ymd(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

const DAYS_AHEAD_KEY = 'staff.visibleDaysAhead'
const DEFAULT_DAYS_AHEAD = 1

async function getConfiguredDaysAhead(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: DAYS_AHEAD_KEY } })
  const value = setting?.value
  if (value === 'week') return 7
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAYS_AHEAD
}

/**
 * Dates (as YYYY-MM-DD, in America/New_York) visible to a "user" role staff
 * member. Today is always included. Beyond today, a date is visible only if
 * an admin has explicitly published it (see PublishedSchedule / the mobile
 * "Publish schedule" action) AND it falls within the admin-configured
 * look-ahead window (Settings/Staff -> staff.visibleDaysAhead: 1-4 or 7).
 * Replaces the old rule of auto-revealing tomorrow at 6 PM.
 */
export async function getVisibleServiceDates(now: Date = new Date()): Promise<string[]> {
  const { year, month, day } = localDateParts(now)
  const today = ymd(year, month, day)

  const daysAhead = await getConfiguredDaysAhead()
  const windowEnd = new Date(Date.UTC(year, month - 1, day + daysAhead, 23, 59, 59))
  const windowStart = new Date(Date.UTC(year, month - 1, day + 1))

  const published = await prisma.publishedSchedule.findMany({
    where: { date: { gte: windowStart, lte: windowEnd } },
    select: { date: true },
  })

  const dates = [today, ...published.map(p => p.date.toISOString().slice(0, 10))]
  return Array.from(new Set(dates))
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
