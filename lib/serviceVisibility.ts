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
 * How many days back of already-worked services this staff member keeps,
 * per their individual User.schedulePastVisibility. Returns the dates
 * strictly before today, newest first — today is added by the caller.
 *
 * 'week' means the current work week: Monday through yesterday. On a Monday
 * that is an empty list (today is the whole week so far). The numeric
 * settings are rolling instead — '7' is simply the last 7 calendar days.
 *
 * Past days carry no publish gate: they were already visible to the staff
 * member while they were "today", so withholding them now buys nothing.
 */
function pastVisibleDates(setting: string, year: number, month: number, day: number): string[] {
  if (!setting || setting === '0') return []

  let daysBack: number
  if (setting === 'week') {
    // getUTCDay(): 0=Sunday..6=Saturday. Sunday closes the week that started
    // the previous Monday (6 days back), it does not open a new one.
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    daysBack = weekday === 0 ? 6 : weekday - 1
  } else {
    daysBack = Number(setting) > 0 ? Number(setting) : 0
  }

  const dates: string[] = []
  for (let i = 1; i <= daysBack; i++) dates.push(ymd(year, month, day - i))
  return dates
}

/**
 * How far a "user" role staff member can see into their own assigned
 * services, per their individual User.scheduleVisibility ('1'-'4', 'week',
 * or 'full') and User.schedulePastVisibility ('0', 'week', '7'/'14'/'30')
 * — both set per-person from their card on the Staff page.
 *
 * Today is always included. Beyond today, a date only counts if an admin
 * has explicitly published it (PublishedSchedule / the mobile "Publish
 * schedule" action) AND it falls within this staff member's window.
 * 'full' skips the windows and the publish gate entirely.
 */
export async function getVisibleServiceDates(userId: string, now: Date = new Date()): Promise<ServiceVisibility> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { scheduleVisibility: true, schedulePastVisibility: true },
  })
  const setting = user?.scheduleVisibility || '1'

  if (setting === 'full') return { unrestricted: true }

  const { year, month, day } = localDateParts(now)
  const today = ymd(year, month, day)
  const past = pastVisibleDates(user?.schedulePastVisibility || '0', year, month, day)

  const daysAhead = setting === 'week' ? 7 : (Number(setting) > 0 ? Number(setting) : 1)
  const windowStart = new Date(Date.UTC(year, month - 1, day + 1))
  const windowEnd   = new Date(Date.UTC(year, month - 1, day + daysAhead, 23, 59, 59))

  const published = await prisma.publishedSchedule.findMany({
    where: { date: { gte: windowStart, lte: windowEnd } },
    select: { date: true },
  })

  const dates = [...past, today, ...published.map(p => p.date.toISOString().slice(0, 10))]
  return { unrestricted: false, dates: Array.from(new Set(dates)) }
}

/**
 * Whether a 'user' role staff member may open this specific service: it has to
 * be assigned to them AND fall inside the dates their visibility window allows.
 * Admins bypass this entirely — callers check the role first.
 */
export async function assertUserCanAccess(serviceId: string, userId: string): Promise<boolean> {
  const visibility = await getVisibleServiceDates(userId)
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      ...(visibility.unrestricted ? {} : { serviceDate: { in: visibility.dates.map(d => new Date(d)) } }),
      staff: { some: { userId } },
    },
    select: { id: true },
  })
  return !!service
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
