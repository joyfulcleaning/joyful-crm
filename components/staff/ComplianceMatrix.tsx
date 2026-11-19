'use client'

import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import { DOC_STATUS_COLORS, DocStatus, STAFF_DOCUMENTS, complianceOf } from '@/lib/staff-documents'

const MARKS: Record<DocStatus, string> = { valid: '✓', expiring: '!', expired: '✕', missing: '○', na: '·' }

interface Props {
  staff:     any[]
  documents: any[]
  onOpen:    (member: any) => void
}

export default function ComplianceMatrix({ staff, documents, onOpen }: Props) {
  const { t } = useI18n()
  const sd = t.staffDocs
  const today = localDateStr()
  const people = staff.filter(s => s.status !== 'inactive').map(m => ({ member: m, c: complianceOf(m, documents, today) }))

  const required = people.reduce((s, p) => s + p.c.rows.filter(r => r.required).length, 0)
  const ok = people.reduce((s, p) => s + p.c.rows.filter(r => r.required && (r.status === 'valid' || r.status === 'expiring')).length, 0)
  const pct = required ? Math.round((ok / required) * 100) : 100
  const total = (k: 'valid' | 'expiring' | 'expired' | 'missing') => people.reduce((s, p) => s + p.c[k], 0)

  return (
    <div className="space-y-4">
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#38d9a9 ${pct * 3.6}deg, #2a2f3d 0deg)` }}>
          <div className="w-9 h-9 rounded-full bg-[#161922] flex items-center justify-center text-[11px] font-bold text-[#e8eaf0]">{pct}%</div>
        </div>
        <div>
          <div className="text-sm font-bold text-[#e8eaf0]">{sd.compliance}</div>
          <div className="text-[11px] text-[#6b7280]">{sd.summary(total('valid'), total('expiring'), total('expired'), total('missing'))}</div>
        </div>
        <div className="ml-auto text-[10px] text-[#6b7280]">{sd.matrixHint}</div>
      </div>

      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#2a2f3d]">
              <th className="sticky left-0 bg-[#161922] z-10 px-3 py-2.5 text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider min-w-44">{t.staffHr.columns.name}</th>
              {STAFF_DOCUMENTS.map(d => (
                <th key={d.key} title={sd.names[d.key]} className="px-2 py-2.5 text-[10px] font-bold text-[#6b7280] whitespace-nowrap">{sd.short[d.key]}</th>
              ))}
              <th className="px-3 py-2.5 text-[10px] font-bold text-[#6b7280]">%</th>
            </tr>
          </thead>
          <tbody>
            {people.map(({ member, c }) => (
              <tr key={member.id} onClick={() => onOpen(member)} className="border-b border-[#1e2330] last:border-0 hover:bg-[rgba(79,142,247,0.05)] cursor-pointer">
                <td className="sticky left-0 bg-[#161922] z-10 px-3 py-2 text-xs font-semibold text-[#e8eaf0] whitespace-nowrap">{member.name}</td>
                {c.rows.map(r => {
                  const color = DOC_STATUS_COLORS[r.status]
                  const solid = r.status === 'expired'
                  return (
                    <td key={r.key} className="px-2 py-2 text-center" title={`${sd.names[r.key]}: ${sd.statuses[r.status]}`}>
                      <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-[11px] font-bold"
                        style={{
                          backgroundColor: solid ? color : r.status === 'na' ? 'transparent' : `${color}1f`,
                          color: solid ? '#0d0f14' : color,
                          border: r.status === 'missing' ? `1px dashed ${color}` : 'none',
                        }}>
                        {MARKS[r.status]}
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-xs font-semibold" style={{ color: c.pct === 100 ? '#38d9a9' : c.pct >= 70 ? '#f59e0b' : '#f87171' }}>{c.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
