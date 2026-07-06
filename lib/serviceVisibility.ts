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

export type ServiceVisibility =
  | { unrestricted: true }
  | { unrestricted: false; dates: string[] }

/**
 * How far a "user" role staff member can see into their own assigned
 * services, per their individual User.scheduleVisibility ('1'-'4', 'week',
 * or 'full' — set per-person from their card on the Staff page).
 *
 * Today is always included. Beyond today, a date only counts if an admin
 * has explicitly published it (PublishedSchedule / the mobile "Publish
 * schedule" action) AND it falls within this staff member's window.
 * 'full' skips both the window and the publish gate entirely.
 */
export async function getVisibleServiceDates(userId: string, now: Date = new Date()): Promise<ServiceVisibility> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { scheduleVisibility: true } })
  const setting = user?.scheduleVisibility || '1'

  if (setting === 'full') return { unrestricted: true }

  const { year, month, day } = localDateParts(now)
  const today = ymd(year, month, day)

  const daysAhead = setting === 'week' ? 7 : (Number(setting) > 0 ? Number(setting) : 1)
  const windowStart = new Date(Date.UTC(year, month - 1, day + 1))
  const windowEnd   = new Date(Date.UTC(year, month - 1, day + daysAhead, 23, 59, 59))

  const published = await prisma.publishedSchedule.findMany({
    where: { date: { gte: windowStart, lte: windowEnd } },
    select: { date: true },
  })

  const dates = [today, ...published.map(p => p.date.toISOString().slice(0, 10))]
  return { unrestricted: false, dates: Array.from(new Set(dates)) }
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
