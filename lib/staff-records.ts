// Shapes of the HR record kinds stored in StaffRecord. Shared by the API, which
// validates against them, and the web forms, which are built from them. Adding a
// kind here is all it takes: no database change.

export type RecordFieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'bool' | 'score'

export interface RecordField {
  key:       string
  type:      RecordFieldType
  required?: boolean
  options?:  string[]
  // 'date' and 'endDate' go to their own columns; everything else into data.
  column?:   'date' | 'endDate'
}

export const RECORD_KINDS: Record<string, { fields: RecordField[] }> = {
  incident: {
    fields: [
      { key: 'date', type: 'date', required: true, column: 'date' },
      { key: 'type', type: 'select', required: true, options: ['late', 'early', 'noshow'] },
      { key: 'minutes', type: 'number' },
      { key: 'serviceNumber', type: 'text' },
      { key: 'justified', type: 'bool' },
      { key: 'note', type: 'textarea' },
    ],
  },
  equipment: {
    fields: [
      { key: 'category', type: 'select', required: true, options: ['equipment', 'uniform', 'vehicle', 'phone', 'other'] },
      { key: 'name', type: 'text', required: true },
      { key: 'identifier', type: 'text' },
      { key: 'date', type: 'date', column: 'date' },
      { key: 'endDate', type: 'date', column: 'endDate' },
      { key: 'note', type: 'textarea' },
    ],
  },
  key: {
    fields: [
      { key: 'client', type: 'text', required: true },
      { key: 'keyLabel', type: 'text' },
      { key: 'code', type: 'text' },
      { key: 'date', type: 'date', column: 'date' },
      { key: 'endDate', type: 'date', column: 'endDate' },
      { key: 'note', type: 'textarea' },
    ],
  },
  training: {
    fields: [
      { key: 'name', type: 'text', required: true },
      { key: 'date', type: 'date', column: 'date' },
      { key: 'endDate', type: 'date', column: 'endDate' },
      { key: 'note', type: 'textarea' },
    ],
  },
  review: {
    fields: [
      { key: 'date', type: 'date', required: true, column: 'date' },
      { key: 'quality', type: 'score', required: true },
      { key: 'punctuality', type: 'score', required: true },
      { key: 'teamwork', type: 'score', required: true },
      { key: 'communication', type: 'score', required: true },
      { key: 'comment', type: 'textarea' },
    ],
  },
  note: {
    fields: [
      { key: 'visibility', type: 'select', required: true, options: ['hr', 'supervisors'] },
      { key: 'body', type: 'textarea', required: true },
    ],
  },
  discipline: {
    fields: [
      { key: 'date', type: 'date', required: true, column: 'date' },
      { key: 'level', type: 'select', required: true, options: ['verbal', 'written', 'final', 'suspension'] },
      { key: 'description', type: 'textarea', required: true },
      { key: 'note', type: 'textarea' },
    ],
  },
}

export const SCORE_MAX = 5

export class RecordInputError extends Error {}

// Returns the columns and the data blob for one record, or throws on bad input.
// `partial` is for edits: fields that weren't sent are left alone.
export function parseRecordValues(kind: string, values: Record<string, any>, partial = false) {
  const def = RECORD_KINDS[kind]
  if (!def) throw new RecordInputError('Unknown record kind')
  const columns: { date?: string | null; endDate?: string | null } = {}
  const data: Record<string, any> = {}

  for (const f of def.fields) {
    const raw = values?.[f.key]
    if (raw === undefined && partial) continue
    const empty = raw === undefined || raw === null || raw === ''
    if (empty) {
      if (f.required) throw new RecordInputError(`${f.key} is required`)
      if (f.column) columns[f.column] = null
      else data[f.key] = null
      continue
    }

    let value: any = raw
    if (f.type === 'date') {
      value = String(raw).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RecordInputError(`${f.key} is not a date`)
    } else if (f.type === 'number' || f.type === 'score') {
      value = Number(raw)
      const max = f.type === 'score' ? SCORE_MAX : 100000
      if (!Number.isFinite(value) || value < (f.type === 'score' ? 1 : 0) || value > max) throw new RecordInputError(`${f.key} is out of range`)
    } else if (f.type === 'bool') {
      value = raw === true || raw === 'true'
    } else if (f.type === 'select') {
      if (!f.options!.includes(String(raw))) throw new RecordInputError(`${f.key} is not a valid option`)
      value = String(raw)
    } else {
      value = String(raw).trim().slice(0, 5000)
    }

    if (f.column) columns[f.column] = value
    else data[f.key] = value
  }
  return { columns, data }
}

// A record's values flattened back into one object, columns included.
export function recordValues(record: any) {
  return {
    ...(record.data ?? {}),
    date:    record.date?.slice?.(0, 10) ?? record.date ?? null,
    endDate: record.endDate?.slice?.(0, 10) ?? record.endDate ?? null,
  }
}

export function reviewAverage(record: any) {
  const scores = RECORD_KINDS.review.fields.filter(f => f.type === 'score').map(f => Number(record.data?.[f.key]) || 0)
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
}
