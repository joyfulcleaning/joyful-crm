// Shared by the staff directory and the HR file. No server imports: this runs
// in the browser.

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'seasonal'] as const
export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// Days ahead that a work permit counts as "expiring soon".
export const PERMIT_ALERT_DAYS = 60

export const COMPLETENESS_FIELDS = [
  'phone', 'hireDate', 'dateOfBirth', 'taxId', 'emergencyContact',
  'jobTitle', 'employmentType', 'address', 'pay',
] as const
export type CompletenessField = typeof COMPLETENESS_FIELDS[number]

export function missingFields(member: any): CompletenessField[] {
  const p = member.hrProfile
  const has: Record<CompletenessField, boolean> = {
    phone:            !!member.phone,
    hireDate:         !!member.hireDate,
    dateOfBirth:      !!member.dateOfBirth,
    taxId:            !!member.taxId,
    emergencyContact: !!(member.emergencyContactName && member.emergencyContactPhone),
    jobTitle:         !!p?.jobTitle,
    employmentType:   !!p?.employmentType,
    address:          !!(p?.addressLine && p?.city),
    pay:              member.scheduleType === 'per_service' ? !!member.payRates : !!member.hourlyRate,
  }
  return COMPLETENESS_FIELDS.filter(f => !has[f])
}

export function completeness(member: any) {
  const total = COMPLETENESS_FIELDS.length
  return Math.round(((total - missingFields(member).length) / total) * 100)
}

export function isOnProbation(member: any, today: string) {
  const end = member.hrProfile?.probationEndDate?.slice(0, 10)
  return member.status === 'active' && !!end && end >= today
}

// Whole days from today; negative once the date has passed.
export function daysUntil(dateStr: string, today: string) {
  const a = Date.parse(`${dateStr.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  return Math.round((a - b) / 86400000)
}

export function permitExpiringSoon(member: any, today: string) {
  if (!member.workPermit || !member.workPermitExpiry || member.status === 'inactive') return false
  return daysUntil(member.workPermitExpiry, today) <= PERMIT_ALERT_DAYS
}

export const STAFF_STATUS_COLORS: Record<string, string> = {
  active: '#38d9a9', invited: '#f59e0b', inactive: '#6b7280', probation: '#a78bfa', on_leave: '#4f8ef7',
}

export function initialsOf(name: string) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${m}-${d}-${y}`
}

// "$600 / week", or the supplied label for per-service pay and unset rates.
export function payText(member: any, labels: { payTypes: Record<string, string>; perService: string; noPay: string }) {
  if (member.scheduleType === 'per_service') return labels.perService
  if (!member.hourlyRate) return labels.noPay
  const amount = `$${Number(member.hourlyRate).toLocaleString('en-US')}`
  const unit = labels.payTypes[member.scheduleType]
  return unit ? `${amount} / ${unit}` : amount
}

// Completed years and months between a hire date and today.
export function tenure(hireDate: string, today: string) {
  const [hy, hm, hd] = hireDate.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const months = Math.max((ty - hy) * 12 + (tm - hm) - (td < hd ? 1 : 0), 0)
  return { years: Math.floor(months / 12), months: months % 12 }
}
