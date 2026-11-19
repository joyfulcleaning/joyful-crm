'use client'

import { useI18n } from '@/lib/i18n'
import { fmtDate } from '@/lib/staff-profile'

interface Props {
  audit: any[] | null
}

// The file's change log. Built from audit entries, which store field names and
// never values, so nothing sensitive is repeated here.
export default function ProfileHistory({ audit }: Props) {
  const { t } = useI18n()
  const h = t.staffRecords.history
  const fieldLabels = t.staffHr.profile.fields as Record<string, string>

  function describe(entry: any) {
    const d = entry.details ?? {}
    const what = h.entities[entry.entity] ?? entry.entity
    const kind = d.kind ? ` · ${t.staffRecords.titles[d.kind] ?? d.kind}` : ''
    const doc = d.docType ? ` · ${t.staffDocs.names[d.docType] ?? d.docType}` : ''
    const absence = entry.entity === 'staffAbsence' && d.type ? ` · ${t.staffAbsence.types[d.type] ?? d.type}` : ''
    const action = d.viewed ? h.viewed : d.action && entry.entity === 'staffAbsence'
      ? (t.staffAbsence.statuses[{ approve: 'approved', reject: 'rejected', cancel: 'cancelled' }[d.action as string] ?? ''] ?? d.action)
      : h.actions[entry.action] ?? entry.action
    return `${what}${kind}${doc}${absence}: ${action}`
  }

  function fields(entry: any) {
    const list: string[] = Array.isArray(entry.details?.fields) ? entry.details.fields : []
    const names = list.filter(k => k !== 'id').map(k => fieldLabels[k] ?? k)
    if (entry.details?.passwordChanged) names.push(h.password)
    return names.length ? h.fields(names.join(', ')) : ''
  }

  return (
    <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2f3d] text-sm font-bold text-[#e8eaf0]">{h.title}</div>
      <div className="divide-y divide-[#1e2330]">
        {audit === null && <div className="px-4 py-6 text-center text-xs text-[#6b7280]">…</div>}
        {audit?.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#6b7280]">{h.empty}</div>}
        {audit?.map(entry => (
          <div key={entry.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#e8eaf0]">{describe(entry)}</span>
              <span className="text-[10px] text-[#6b7280] whitespace-nowrap">{fmtDate(entry.createdAt)} {new Date(entry.createdAt).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-[11px] text-[#6b7280]">
              {entry.actor && h.by(entry.actor)}{fields(entry) && ` · ${fields(entry)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
