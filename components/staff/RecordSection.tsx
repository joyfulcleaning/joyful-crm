'use client'

import { useState } from 'react'
import { Plus, Save, Trash2, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fmtDate } from '@/lib/staff-profile'
import { RECORD_KINDS, RecordField, SCORE_MAX, recordValues } from '@/lib/staff-records'

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'
const TH = 'px-3 py-2.5 text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider whitespace-nowrap'
const TD = 'px-3 py-2.5 text-xs text-[#e8eaf0] align-top'

export function useRecordLabels() {
  const { t } = useI18n()
  const sr = t.staffRecords
  const label = (kind: string, key: string) => sr.kindFields[kind]?.[key] ?? sr.fields[key] ?? key
  const display = (f: RecordField, value: any) => {
    if (value === null || value === undefined || value === '') return '—'
    if (f.type === 'date') return fmtDate(String(value))
    if (f.type === 'bool') return value ? sr.yes : sr.no
    if (f.type === 'select') return sr.options[f.key]?.[value] ?? String(value)
    if (f.type === 'score') return `${value}/${SCORE_MAX}`
    return String(value)
  }
  return { sr, label, display }
}

interface Extra { label: string; render: (record: any) => React.ReactNode }

interface Props {
  member:   any
  kind:     string
  records:  any[]
  // Field keys shown as table columns; the rest only appear in the form.
  columns:  string[]
  extra?:   Extra
  onChanged: () => void
}

export default function RecordSection({ member, kind, records, columns, extra, onChanged }: Props) {
  const { sr, label, display } = useRecordLabels()
  const fields = RECORD_KINDS[kind].fields
  const shown = columns.map(key => fields.find(f => f.key === key)!).filter(Boolean)
  const rows = records.filter(r => r.kind === kind)

  // null: closed; {}: a new record; a record: editing it.
  const [editing, setEditing]   = useState<any>(null)
  const [values, setValues]     = useState<Record<string, any>>({})
  const [saving, setSaving]     = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError]       = useState('')

  function open(record: any) {
    setEditing(record)
    setValues(record.id ? recordValues(record) : {})
    setConfirming(false); setError('')
  }

  async function save() {
    const missing = fields.find(f => f.required && (values[f.key] === undefined || values[f.key] === null || values[f.key] === ''))
    if (missing) { setError(sr.required(label(kind, missing.key))); return }
    setSaving(true); setError('')
    try {
      const res = editing.id
        ? await fetch(`/api/staff/${member.id}/records/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }),
          })
        : await fetch(`/api/staff/${member.id}/records`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, values }),
          })
      if (!res.ok) throw new Error()
      setEditing(null); onChanged()
    } catch {
      setError(sr.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirming) { setConfirming(true); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/staff/${member.id}/records/${editing.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEditing(null); onChanged()
    } catch {
      setError(sr.saveError)
    } finally {
      setSaving(false)
    }
  }

  function input(f: RecordField) {
    const value = values[f.key] ?? ''
    const set = (v: any) => setValues(prev => ({ ...prev, [f.key]: v }))
    if (f.type === 'textarea') return <textarea rows={3} value={value} onChange={e => set(e.target.value)} className={`${INPUT} resize-none`} />
    if (f.type === 'bool') {
      return (
        <select value={value === '' ? '' : String(value)} onChange={e => set(e.target.value === '' ? '' : e.target.value === 'true')} className={INPUT}>
          <option value="">—</option>
          <option value="true">{sr.yes}</option>
          <option value="false">{sr.no}</option>
        </select>
      )
    }
    if (f.type === 'select') {
      return (
        <select value={value} onChange={e => set(e.target.value)} className={INPUT}>
          <option value="">—</option>
          {f.options!.map(o => <option key={o} value={o}>{sr.options[f.key]?.[o] ?? o}</option>)}
        </select>
      )
    }
    if (f.type === 'score') {
      return (
        <div className="flex gap-1">
          {Array.from({ length: SCORE_MAX }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => set(n)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                Number(value) === n ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
              }`}>{n}</button>
          ))}
        </div>
      )
    }
    return <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} min={f.type === 'number' ? 0 : undefined}
      value={value} onChange={e => set(e.target.value)} className={INPUT} />
  }

  return (
    <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#e8eaf0]">{sr.titles[kind]}</span>
        <button onClick={() => open({})}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all">
          <Plus size={12} />{sr.add}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2f3d]">
              {shown.map(f => <th key={f.key} className={TH}>{label(kind, f.key)}</th>)}
              {extra && <th className={TH}>{extra.label}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const v = recordValues(r)
              return (
                <tr key={r.id} onClick={() => open(r)} className="border-b border-[#1e2330] last:border-0 hover:bg-[rgba(79,142,247,0.05)] cursor-pointer transition-colors">
                  {shown.map(f => (
                    <td key={f.key} className={`${TD} ${f.type === 'textarea' ? 'whitespace-pre-wrap min-w-48' : 'whitespace-nowrap'}`}>{display(f, v[f.key])}</td>
                  ))}
                  {extra && <td className={`${TD} whitespace-nowrap`}>{extra.render(r)}</td>}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={shown.length + (extra ? 1 : 0)} className="px-3 py-6 text-center text-xs text-[#6b7280]">{sr.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
            <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
              <div className="text-sm font-bold text-[#e8eaf0]">{sr.titles[kind]}</div>
              <button onClick={() => setEditing(null)} aria-label={sr.cancel} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {error && (
                <div className="col-span-full bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>
              )}
              {fields.map(f => (
                <div key={f.key} className={f.type === 'textarea' ? 'col-span-full' : ''}>
                  <label className={LABEL}>{label(kind, f.key)}{f.required && <span className="text-[#f87171]"> *</span>}</label>
                  {input(f)}
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-[#161922] border-t border-[#2a2f3d] px-6 py-4 flex items-center gap-3">
              {editing.id && (
                <button onClick={remove} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#f87171] hover:border-[#f87171] transition-all disabled:opacity-50">
                  <Trash2 size={12} />{confirming ? sr.confirmRemove : sr.remove}
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
                {sr.cancel}
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                <Save size={13} />{saving ? sr.saving : sr.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
