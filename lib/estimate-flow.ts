import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { baseUrl } from './oauth'
import { HOURLY_SLOTS, isWorkingDay, nowInEastern } from './scheduling'

/**
 * The client-facing half of an estimate: the /e/[token] link the client
 * opens without logging in to accept, ask for changes, decline or ask a
 * question, and the back-and-forth that settles the service date afterwards.
 *
 * State lives in explicit Estimate columns (response, schedulingPending,
 * agreedDate…) so lists can filter on it; `events` is the append-only
 * history the app shows on the visit.
 */

export type FlowLang = 'en' | 'es'
export const asLang = (v: unknown): FlowLang => (v === 'es' ? 'es' : 'en')

export type DayWindow = 'morning' | 'afternoon' | 'any'
export const WINDOWS: DayWindow[] = ['morning', 'afternoon', 'any']
export const asWindow = (v: unknown): DayWindow | null =>
  WINDOWS.includes(v as DayWindow) ? (v as DayWindow) : null

export type FlowEvent = {
  type:
    | 'sent' | 'viewed' | 'question' | 'accepted' | 'changes' | 'declined'
    | 'proposed' | 'suggested' | 'confirmed' | 'reopened' | 'service'
  at: string
  by: 'client' | 'team'
  via?: 'email' | 'sms' | 'phone'
  date?: string // YYYY-MM-DD
  window?: DayWindow
  time?: string // HH:MM
  note?: string
  reason?: string
  userName?: string
}

// What the calendar needs of a visit's linked estimate to show where it stands.
export const ESTIMATE_SUMMARY = {
  id: true, estimateNumber: true, total: true, status: true, lang: true,
  sentAt: true, sentVia: true, emailSentAt: true, viewedAt: true,
  response: true, respondedAt: true, schedulingPending: true, agreedDate: true, agreedTime: true, serviceId: true,
} as const

// Typed for Prisma's Json input; read it back as FlowEvent[].
export function appendEvent(events: unknown, event: Omit<FlowEvent, 'at'>): Prisma.InputJsonArray {
  const list = Array.isArray(events) ? (events as FlowEvent[]) : []
  return [...list, { ...event, at: new Date().toISOString() }] as unknown as Prisma.InputJsonArray
}

// 18 random bytes → 24 url-safe characters. Never derived from the estimate
// number, which is sequential and printed on the PDF.
export function newPublicToken(): string {
  return crypto.randomBytes(18).toString('base64url')
}

export function estimateLink(token: string, request?: Request): string {
  return `${baseUrl(request)}/e/${token}`
}

export async function ensurePublicToken(estimateId: string, current: string | null): Promise<string> {
  if (current) return current
  const token = newPublicToken()
  await prisma.estimate.update({ where: { id: estimateId }, data: { publicToken: token } })
  return token
}

export function ymd(d: Date | string): string {
  return (typeof d === 'string' ? d : d.toISOString()).slice(0, 10)
}

// validUntil is a @db.Date: the estimate is still good through that whole day.
export function isExpired(validUntil: Date): boolean {
  return ymd(validUntil) < nowInEastern().date
}

const isMorning = (time: string) => Number(time.slice(0, 2)) < 12

export type OfferedDay = { date: string; morning: boolean; afternoon: boolean }

/**
 * The next working days with at least one free hourly slot, using the same
 * grid the phone assistant books against (HOURLY_SLOTS, one crew per hour,
 * WORKING_DAYS). Starts tomorrow: a same-day cleaning is never offered from
 * an emailed link.
 */
export async function offeredDays(count = 5, horizonDays = 30, until?: Date): Promise<OfferedDay[]> {
  const today = nowInEastern().date
  const start = new Date(`${today}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() + 1)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + horizonDays)
  const limit = until && until < end ? until : end

  const services = await prisma.service.findMany({
    where: { serviceDate: { gte: start, lte: limit }, status: { not: 'cancelled' } },
    select: { serviceDate: true, serviceTime: true },
  })
  const taken = new Map<string, Set<string>>()
  for (const s of services) {
    const key = ymd(s.serviceDate)
    if (!taken.has(key)) taken.set(key, new Set())
    taken.get(key)!.add(s.serviceTime)
  }

  const days: OfferedDay[] = []
  for (const d = new Date(start); d <= limit && days.length < count; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = ymd(d)
    if (!isWorkingDay(date)) continue
    const busy = taken.get(date) ?? new Set<string>()
    const free = HOURLY_SLOTS.filter(t => !busy.has(t))
    const morning = free.some(isMorning)
    const afternoon = free.some(t => !isMorning(t))
    if (morning || afternoon) days.push({ date, morning, afternoon })
  }
  return days
}

// Time the service form starts on when the client only gave a window.
export const WINDOW_START: Record<DayWindow, string> = { morning: '09:00', afternoon: '13:00', any: '10:00' }

/* ── wording ──────────────────────────────────────────────────────────── */

const LOCALE: Record<FlowLang, string> = { en: 'en-US', es: 'es-US' }

export function prettyDate(date: string, lang: FlowLang, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return date
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOCALE[lang], { ...opts, timeZone: 'UTC' })
}

export function prettyTime(time: string | null | undefined): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const WINDOW_LABEL: Record<FlowLang, Record<DayWindow, string>> = {
  en: { morning: 'Morning', afternoon: 'Afternoon', any: 'Any time' },
  es: { morning: 'En la mañana', afternoon: 'En la tarde', any: 'A cualquier hora' },
}

export const DECLINE_REASONS: Record<FlowLang, Record<string, string>> = {
  en: { price: 'Price is too high', other_company: 'Chose another company', not_needed: 'No longer needed', other: 'Other' },
  es: { price: 'El precio es muy alto', other_company: 'Elegí otra compañía', not_needed: 'Ya no lo necesito', other: 'Otro' },
}

export const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || name

/**
 * Columns to write when the estimate goes out (again) to the client. A
 * resend after the client asked for changes or declined reopens it so they
 * can answer the updated version; a resend after acceptance keeps the
 * acceptance and the date back-and-forth as they are.
 */
export function sentUpdate(est: { response: string | null; events: unknown }, via: 'email' | 'sms', lang: FlowLang, userName: string) {
  const reopen = est.response === 'changes' || est.response === 'declined'
  return {
    sentAt: new Date(),
    sentVia: via,
    lang,
    ...(via === 'email' ? { emailSentAt: new Date() } : {}),
    ...(reopen ? { response: null, respondedAt: null, responseNote: null, declineReason: null, schedulingPending: null, viewedAt: null } : {}),
    events: appendEvent(est.events, { type: 'sent', by: 'team', via, userName }),
  }
}
