// Document catalog and compliance rules. No server imports: runs in the browser.

import { daysUntil } from './staff-profile'

export const DOCUMENTS_BUCKET = 'staff-documents'

// Days ahead that a document counts as "expiring".
export const DOC_ALERT_DAYS = 60

// `required`: every active person must have it. `requiredFor`: only people
// with one of these employment types must have it; anyone else may still have
// one on file. `expires`: carries a date.
type StaffDocumentDef = { key: string; required: boolean; requiredFor?: string[]; expires: boolean }

export const STAFF_DOCUMENTS: StaffDocumentDef[] = [
  { key: 'i9',       required: true,  expires: false },
  { key: 'w4',       required: true,  expires: false },
  { key: 'w9',       required: false, requiredFor: ['contractor'], expires: false },
  { key: 'nc4',      required: true,  expires: false },
  { key: 'contract', required: true,  expires: false },
  { key: 'photoId',  required: true,  expires: true  },
  { key: 'license',  required: false, expires: true  },
  { key: 'background', required: true, expires: true },
  { key: 'keys',     required: true,  expires: false },
  { key: 'hazcom',   required: true,  expires: true  },
  { key: 'deposit',  required: false, expires: false },
  { key: 'handbook', required: true,  expires: false },
]

export function isDocRequired(def: StaffDocumentDef, employmentType: string | null | undefined) {
  return def.required || (!!employmentType && !!def.requiredFor?.includes(employmentType))
}

export type DocStatus = 'valid' | 'expiring' | 'expired' | 'missing' | 'na'

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  valid: '#38d9a9', expiring: '#f59e0b', expired: '#f87171', missing: '#f87171', na: '#4b5263',
}

// Newest row of each type for one person.
export function latestDocs(documents: any[], userId: string) {
  const map = new Map<string, any>()
  for (const d of documents) {
    if (d.userId !== userId) continue
    const prev = map.get(d.docType)
    if (!prev || d.createdAt > prev.createdAt) map.set(d.docType, d)
  }
  return map
}

export function docStatus(doc: any | undefined, required: boolean, today: string): DocStatus {
  if (!doc) return required ? 'missing' : 'na'
  if (!doc.expiresAt) return 'valid'
  const left = daysUntil(doc.expiresAt, today)
  return left < 0 ? 'expired' : left <= DOC_ALERT_DAYS ? 'expiring' : 'valid'
}

// Inactive people are left out of compliance entirely.
export function complianceOf(member: any, documents: any[], today: string) {
  const latest = latestDocs(documents, member.id)
  const rows = STAFF_DOCUMENTS.map(def => {
    const required = isDocRequired(def, member.hrProfile?.employmentType)
    return { ...def, required, doc: latest.get(def.key), status: docStatus(latest.get(def.key), required, today) }
  })
  const count = (s: DocStatus) => rows.filter(r => r.status === s).length
  const required = rows.filter(r => r.required)
  const ok = required.filter(r => r.status === 'valid' || r.status === 'expiring').length
  return {
    rows,
    valid: count('valid'), expiring: count('expiring'), expired: count('expired'), missing: count('missing'),
    pct: required.length ? Math.round((ok / required.length) * 100) : 100,
    alerts: count('expiring') + count('expired') + count('missing'),
  }
}

export function fileSizeText(bytes: number | null | undefined) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
