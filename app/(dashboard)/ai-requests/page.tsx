'use client'

import { useState, useEffect } from 'react'
import { Eye } from 'lucide-react'
import { useSyncPoll } from '@/lib/useSyncPoll'
import AiRequestModal from '@/components/modals/AiRequestModal'

const TYPE_LABELS: Record<string, string> = {
  schedule_service: 'Schedule Service',
  reschedule_or_cancel_service: 'Reschedule/Cancel',
  create_sqft_estimate: 'SQFT Estimate',
  schedule_estimate_visit: 'Estimate Visit',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#26BD97',
  rejected: '#f87171',
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${mm}-${dd}-${yyyy} ${time}`
}

export default function AiRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  async function load() {
    try {
      const res = await fetch('/api/ai-requests')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useSyncPoll(['aiRequests'], load)

  async function handleResolve(id: string, body: any) {
    const res = await fetch(`/api/ai-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const updated = await res.json()
    if (res.ok) {
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      setSelected(null)
    } else {
      alert(updated.error || 'Failed to update request')
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length
  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">AI Requests</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Full history of requests from the AI phone assistant, newest first</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'all' as const, label: 'Total', value: requests.length, color: '#6b7280' },
          { key: 'pending' as const, label: 'Pending', value: pendingCount, color: '#f59e0b' },
          { key: 'approved' as const, label: 'Approved', value: approvedCount, color: '#26BD97' },
          { key: 'rejected' as const, label: 'Rejected', value: rejectedCount, color: '#f87171' },
        ].map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className="bg-[#161922] border rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all"
            style={{ borderColor: filter === card.key ? card.color : '#2a2f3d' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: `${card.color}1a`, color: card.color }}>
              {card.value}
            </div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
          </button>
        ))}
      </div>

      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3d]">
              <th className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280] whitespace-nowrap">Date</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280] whitespace-nowrap">Type</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280] whitespace-nowrap">Customer</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280]">Summary</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 text-[#6b7280] whitespace-nowrap">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-[#6b7280] text-xs">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-[#6b7280] text-xs">No requests {filter === 'all' ? 'yet' : `with status "${filter}"`}.</td></tr>
            ) : filtered.map(r => {
              const color = STATUS_COLORS[r.status] || '#6b7280'
              return (
                <tr
                  key={r.id}
                  className="border-b border-[#2a2f3d]/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-3 py-2.5 text-xs text-[#9ca3af] whitespace-nowrap">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#e8eaf0] whitespace-nowrap">{TYPE_LABELS[r.type] || r.type}</td>
                  <td className="px-3 py-2.5 text-xs text-[#9ca3af] whitespace-nowrap">
                    <div className="text-[#e8eaf0] font-medium">{r.callerName || '—'}</div>
                    <div>{r.callerPhone || ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#6b7280] max-w-xs truncate">{r.summary}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${color}20`, color }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Eye size={13} className="text-[#6b7280]" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AiRequestModal
        request={selected}
        onClose={() => setSelected(null)}
        onResolve={handleResolve}
      />
    </div>
  )
}
