import { nowInEastern } from './scheduling'

/**
 * Shared plumbing for the assistant tool handlers (lib/assistant-read.ts and
 * lib/assistant-write.ts), which back the MCP connector at /api/assistant/mcp.
 */

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string }

export function ok(data: unknown): ToolResult {
  return { ok: true, data }
}

export function fail(error: string): ToolResult {
  return { ok: false, error }
}

export const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Prisma Decimal → plain number, so JSON output carries numbers not strings. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

export function isYmd(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * A `@db.Date` column anchored at midnight UTC — the convention every existing
 * query in this codebase uses. Building these from a local `new Date(str)`
 * would shift the calendar day by the UTC offset.
 */
export function dateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function dayName(ymdStr: string): string {
  return DAY_NAMES_EN[new Date(`${ymdStr}T12:00:00Z`).getUTCDay()]
}

export function today(): string {
  return nowInEastern().date
}

/**
 * Resolves the relative ranges the model reaches for constantly ("this week",
 * "last month") server-side. Asking an LLM to do calendar arithmetic mid-call
 * is how you get reports for the wrong seven days — and the work week here runs
 * Saturday → Friday, which it has no way to know.
 */
export function resolveRange(period: string | undefined, from?: string, to?: string): { from: string; to: string } | { error: string } {
  if (isYmd(from) && isYmd(to)) return { from, to }
  if (from && !isYmd(from)) return { error: 'from must be YYYY-MM-DD' }
  if (to && !isYmd(to)) return { error: 'to must be YYYY-MM-DD' }

  const anchor = today()
  const [y, m, d] = anchor.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const shift = (days: number) => ymd(new Date(utc + days * 86400000))

  // Saturday-start week, matching the CRM's work week.
  const dow = new Date(utc).getUTCDay()
  const daysSinceSaturday = (dow + 1) % 7

  switch (period) {
    case undefined:
    case 'today':
      return { from: anchor, to: anchor }
    case 'yesterday':
      return { from: shift(-1), to: shift(-1) }
    case 'tomorrow':
      return { from: shift(1), to: shift(1) }
    case 'this_week':
      return { from: shift(-daysSinceSaturday), to: shift(6 - daysSinceSaturday) }
    case 'last_week':
      return { from: shift(-daysSinceSaturday - 7), to: shift(-daysSinceSaturday - 1) }
    case 'this_month':
      return { from: `${anchor.slice(0, 7)}-01`, to: ymd(new Date(Date.UTC(y, m, 0))) }
    case 'last_month':
      return { from: ymd(new Date(Date.UTC(y, m - 2, 1))), to: ymd(new Date(Date.UTC(y, m - 1, 0))) }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'next_7_days':
      return { from: anchor, to: shift(7) }
    case 'last_30_days':
      return { from: shift(-30), to: anchor }
    default:
      return { error: `Unknown period "${period}". Use today, yesterday, tomorrow, this_week, last_week, this_month, last_month, this_year, next_7_days, last_30_days — or pass explicit from/to dates.` }
  }
}

export const PERIOD_VALUES = [
  'today',
  'yesterday',
  'tomorrow',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'next_7_days',
  'last_30_days',
]

/** Trims free-text search input and rejects the empty/too-short cases. */
export function cleanQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length >= 2 ? trimmed : null
}

export function clampLimit(value: unknown, fallback = 25, max = 100): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}
