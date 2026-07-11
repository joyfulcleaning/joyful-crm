'use client'

import { useI18n } from '@/lib/i18n'

export type RecentServiceRow = {
  id: string
  serviceNumber: number | string
  clientName: string
  type: string
  dateStr: string   // MM-DD-YYYY or '—'
  status: string
  total: number
}

const statusColors: Record<string, string> = {
  pending:     'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]',
  in_progress: 'bg-[rgba(79,142,247,0.12)] text-[#4f8ef7]',
  completed:   'bg-[rgba(56,217,169,0.1)] text-[#38d9a9]',
  cancelled:   'bg-[rgba(248,113,113,0.1)] text-[#f87171]',
}

export default function RecentServices({ services, showTotals }: {
  services: RecentServiceRow[]
  showTotals: boolean
}) {
  const { t } = useI18n()

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-rest,none)]">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-base font-semibold text-[var(--text)]">{t.dashboard.recentServices}</h2>
      </div>
      <div className="overflow-x-auto">
        {services.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--muted)]">
            {t.dashboard.noServices}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[t.dashboard.colId, t.dashboard.colClient, t.dashboard.colType, t.dashboard.colDate, t.dashboard.colStatus,
                  ...(showTotals ? [t.dashboard.colTotal] : [])].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {services.map(service => (
                <tr key={service.id} className="hover:bg-[var(--surface2)] transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-[#4f8ef7]">
                    #{service.serviceNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">
                    {service.clientName}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--muted2)]">
                    {service.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)]">
                    {service.dateStr}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[service.status] || 'bg-[rgba(107,114,128,0.1)] text-[var(--muted)]'}`}>
                      {t.status[service.status] ?? service.status.replace('_', ' ')}
                    </span>
                  </td>
                  {showTotals && (
                    <td className="px-6 py-4 text-sm font-semibold text-[#38d9a9]">
                      ${service.total.toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
