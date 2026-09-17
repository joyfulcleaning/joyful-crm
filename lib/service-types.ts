// ─── Service types and their category ─────────────────────────────────────────
// Single source of truth for the type dropdown and for the accent colour that
// marks a service in the list, the calendar and the invoice builder.
//
// `Service.type` is a free string in the schema (and SelectWithAdd lets staff
// add their own), so the category is derived from the type name rather than
// stored — anything unknown falls back to `cleaning`, which is the business we
// were before painting.

export const SERVICE_TYPES = [
  'Standard Clean',
  'Deep Clean',
  'Heavy Deep Clean',
  'Office Clean',
  'Move In/Out',
  'Touch Up',
  'Construction Clean',
  'Airbnb Clean',
  'Window Cleaning',
  'Carpet Cleaning',
  'Painting',
  'Cancellation Fee',
  'Inspection Fee',
  'Monthly Cleaning',
  'Biweekly Cleaning',
  'Weekly Cleaning',
]

export type ServiceCategory = 'cleaning' | 'painting'

const PAINTING_TYPES = new Set(['Painting'])

export const CATEGORY_COLOR: Record<ServiceCategory, string> = {
  cleaning: '#4f8ef7',
  painting: '#f97316',
}

export function serviceCategory(type?: string | null): ServiceCategory {
  return type && PAINTING_TYPES.has(type) ? 'painting' : 'cleaning'
}

export function categoryColor(type?: string | null): string {
  return CATEGORY_COLOR[serviceCategory(type)]
}

// Left accent bar: only non-cleaning work gets a visible stripe, so the
// existing cleaning rows keep looking exactly as they did.
export function categoryAccent(type?: string | null): string | null {
  return serviceCategory(type) === 'painting' ? CATEGORY_COLOR.painting : null
}
