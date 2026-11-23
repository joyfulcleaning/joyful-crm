import { prisma } from './prisma'
import { employeeCodeChoices, formatEmployeeCode } from './staff-profile'

export { formatEmployeeCode }

async function codeChoices() {
  const rows = await prisma.staffProfile.findMany({
    where: { employeeCode: { not: null } },
    select: { employeeCode: true },
  })
  return employeeCodeChoices(rows.map(r => r.employeeCode))
}

export async function nextEmployeeCode() {
  return (await codeChoices()).next
}

// The ID for a new hire: the one the admin picked if it is still free,
// otherwise the next automatic one. null means the pick was taken meanwhile.
export async function employeeCodeFor(requested: unknown) {
  const { next, free } = await codeChoices()
  if (!requested || requested === next) return next
  return typeof requested === 'string' && free.includes(requested) ? requested : null
}

const TEXT_FIELDS = [
  'preferredName', 'jobTitle', 'employmentType', 'supervisorId', 'zone',
  'personalEmail', 'altPhone', 'addressLine', 'city', 'state', 'zipCode',
  'medicalNotes', 'bankName', 'bankRouting', 'bankAccount',
] as const
const HOUR_FIELDS = ['vacationHours', 'sickHours', 'personalHours'] as const

export class ProfileInputError extends Error {}

// Only what the request actually sent, so saving one section can never blank
// out another. employeeCode is deliberately absent: it is not editable.
export function pickProfileFields(input: any) {
  const data: Record<string, any> = {}
  if (!input || typeof input !== 'object') return data

  for (const key of TEXT_FIELDS) {
    if (input[key] === undefined) continue
    const value = typeof input[key] === 'string' ? input[key].trim() : input[key]
    data[key] = value || null
  }
  for (const key of HOUR_FIELDS) {
    if (input[key] === undefined) continue
    if (input[key] === null || input[key] === '') { data[key] = null; continue }
    const hours = Number(input[key])
    if (!Number.isFinite(hours) || hours < 0 || hours > 9999) {
      throw new ProfileInputError(`Invalid hours for ${key}`)
    }
    data[key] = hours
  }
  if (input.probationEndDate !== undefined) data.probationEndDate = parseDateOnly(input.probationEndDate)
  if (input.weeklySchedule) data.weeklySchedule = input.weeklySchedule
  return data
}

// Accepts both a plain YYYY-MM-DD from a date input and the full ISO timestamp
// a record comes back with, which is what an untouched date field re-sends.
export function parseDateOnly(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
