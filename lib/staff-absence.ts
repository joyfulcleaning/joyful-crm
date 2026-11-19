// Absence rules shared by the web, the API and (through the API) the mobile app.
// No server imports: this runs in the browser too.

import { WEEK_DAYS } from './staff-profile'

// Days of a request that count as "active": they hold time and block overlaps.
export const ACTIVE_STATUSES = ['pending', 'approved'] as const

export type Bucket = 'vacation' | 'sick' | 'personal'

// `bucket` is the balance a type spends. Types without one spend no balance.
export const ABSENCE_TYPES: Record<string, { color: string; bucket: Bucket | null; unplanned?: boolean }> = {
  vacation:      { color: '#4f8ef7', bucket: 'vacation' },
  sick:          { color: '#f87171', bucket: 'sick', unplanned: true },
  medical:       { color: '#fb923c', bucket: 'sick' },
  personal:      { color: '#a78bfa', bucket: 'personal' },
  bereavement:   { color: '#6b7280', bucket: null },
  jury:          { color: '#94a3b8', bucket: null },
  medical_leave: { color: '#38d9a9', bucket: null },
  parental:      { color: '#2dd4bf', bucket: null },
  unpaid:        { color: '#f59e0b', bucket: null },
  workers_comp:  { color: '#e879f9', bucket: null },
}

export const BUCKET_FIELDS: Record<Bucket, 'vacationHours' | 'sickHours' | 'personalHours'> = {
  vacation: 'vacationHours', sick: 'sickHours', personal: 'personalHours',
}

// How one person works. Teams differ (weekends, holidays, nights, rotations), so
// nothing here is company-wide: it comes from the person's file, and anyone with
// nothing set falls back to the classic pattern below.
export interface WorkPattern {
  workDays:      string[]
  hoursPerDay:   number
  worksHolidays: boolean
  // No fixed days: hours can't be worked out, so an admin enters them.
  rotating:      boolean
}

export const DEFAULT_PATTERN: WorkPattern = {
  workDays: ['mon', 'tue', 'wed', 'thu', 'fri'], hoursPerDay: 8, worksHolidays: false, rotating: false,
}

// Stored as strings next to the day-by-day schedule in weeklySchedule.
export function workPatternOf(member: any): WorkPattern {
  const s = member?.hrProfile?.weeklySchedule ?? {}
  return {
    workDays:      WEEK_DAYS.filter(d => s[`work_${d}`] !== undefined ? s[`work_${d}`] === 'true' : DEFAULT_PATTERN.workDays.includes(d)),
    hoursPerDay:   Number(s.hoursPerDay) || DEFAULT_PATTERN.hoursPerDay,
    worksHolidays: s.worksHolidays === 'true',
    rotating:      s.rotating === 'true',
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const utc = (dateStr: string) => new Date(`${dateStr.slice(0, 10)}T00:00:00Z`)

export function addDays(dateStr: string, days: number) {
  const d = utc(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// nth weekday of a month (weekday: 0 = Sunday). nth 0 means the last one.
function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  if (nth === 0) {
    const last = new Date(Date.UTC(year, month, 0))
    return last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7)
  }
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7
}

// A fixed-date holiday on a weekend is observed on the nearest weekday.
function observed(dateStr: string) {
  const day = utc(dateStr).getUTCDay()
  return day === 6 ? addDays(dateStr, -1) : day === 0 ? addDays(dateStr, 1) : dateStr
}

const holidayCache = new Map<number, Map<string, string>>()

// Date → holiday key, for the seven days the company observes.
export function holidaysOf(year: number) {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const thanksgiving = ymd(year, 11, nthWeekday(year, 11, 4, 4))
  const map = new Map<string, string>([
    [observed(ymd(year, 1, 1)), 'newYear'],
    [ymd(year, 5, nthWeekday(year, 5, 1, 0)), 'memorial'],
    [observed(ymd(year, 7, 4)), 'independence'],
    [ymd(year, 9, nthWeekday(year, 9, 1, 1)), 'labor'],
    [thanksgiving, 'thanksgiving'],
    [addDays(thanksgiving, 1), 'dayAfterThanksgiving'],
    [observed(ymd(year, 12, 25)), 'christmas'],
  ])
  holidayCache.set(year, map)
  return map
}

export function holidayOn(dateStr: string) {
  return holidaysOf(Number(dateStr.slice(0, 4))).get(dateStr.slice(0, 10))
}

export function isWeekend(dateStr: string) {
  const day = utc(dateStr).getUTCDay()
  return day === 0 || day === 6
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function isWorkingDay(dateStr: string, pattern: WorkPattern = DEFAULT_PATTERN) {
  if (pattern.rotating) return true
  if (!pattern.workDays.includes(DAY_KEYS[utc(dateStr).getUTCDay()])) return false
  return pattern.worksHolidays || !holidayOn(dateStr)
}

export function eachDay(from: string, to: string) {
  const days: string[] = []
  for (let d = from.slice(0, 10); d <= to.slice(0, 10); d = addDays(d, 1)) days.push(d)
  return days
}

export function workingDays(from: string, to: string, pattern: WorkPattern = DEFAULT_PATTERN) {
  return eachDay(from, to).filter(d => isWorkingDay(d, pattern)).length
}

// The suggested hours. An admin can always correct them on the absence itself.
export function absenceHours(from: string, to: string, partialHours?: number | null, pattern: WorkPattern = DEFAULT_PATTERN) {
  if (partialHours) return partialHours
  if (pattern.rotating) return 0
  return workingDays(from, to, pattern) * pattern.hoursPerDay
}

export function parseHours(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const hours = Number(value)
  return Number.isFinite(hours) && hours >= 0 && hours <= 9999 ? hours : null
}

export function isActive(absence: { status: string }) {
  return (ACTIVE_STATUSES as readonly string[]).includes(absence.status)
}

export function coversDay(absence: any, dateStr: string) {
  return absence.startDate.slice(0, 10) <= dateStr && absence.endDate.slice(0, 10) >= dateStr
}

export function findOverlap(absences: any[], userId: string, from: string, to: string) {
  return absences.find(a =>
    a.userId === userId && isActive(a) &&
    a.startDate.slice(0, 10) <= to && a.endDate.slice(0, 10) >= from)
}

export interface Balance { bucket: Bucket; granted: number | null; used: number; pending: number; available: number | null }

// An absence counts against the year it starts in. `granted` stays null when
// no hours were set on the person's file: there is then no balance to show.
export function balances(member: any, absences: any[], year: number): Balance[] {
  return (Object.keys(BUCKET_FIELDS) as Bucket[]).map(bucket => {
    const raw = member?.hrProfile?.[BUCKET_FIELDS[bucket]]
    const granted = raw === null || raw === undefined ? null : Number(raw)
    const mine = absences.filter(a =>
      a.userId === member?.id &&
      ABSENCE_TYPES[a.type]?.bucket === bucket &&
      Number(a.startDate.slice(0, 4)) === year)
    const sum = (status: string) => mine.filter(a => a.status === status).reduce((s, a) => s + Number(a.totalHours), 0)
    const used = sum('approved'), pending = sum('pending')
    return { bucket, granted, used, pending, available: granted === null ? null : granted - used - pending }
  })
}

// Bradford factor over the last 12 months, unplanned approved absences only:
// spells² × days. Rewards a single long illness over many scattered ones.
export function bradford(absences: any[], userId: string, today: string, pattern: WorkPattern = DEFAULT_PATTERN) {
  const since = addDays(today, -365)
  const spells = absences.filter(a =>
    a.userId === userId && a.status === 'approved' &&
    ABSENCE_TYPES[a.type]?.unplanned &&
    a.startDate.slice(0, 10) >= since && a.startDate.slice(0, 10) <= today)
  const days = spells.reduce((s, a) => s + workingDays(a.startDate, a.endDate, pattern), 0)
  return spells.length * spells.length * days
}

export function bradfordLevel(score: number) {
  return score < 50 ? 'low' : score < 125 ? 'moderate' : score < 400 ? 'high' : 'critical'
}

export const BRADFORD_COLORS: Record<string, string> = {
  low: '#38d9a9', moderate: '#f59e0b', high: '#fb923c', critical: '#f87171',
}

export const ABSENCE_STATUS_COLORS: Record<string, string> = {
  approved: '#38d9a9', pending: '#f59e0b', rejected: '#f87171', cancelled: '#6b7280',
}
