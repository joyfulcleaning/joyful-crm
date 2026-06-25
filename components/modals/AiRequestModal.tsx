'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, X } from 'lucide-react'
import { HOURLY_SLOTS } from '@/lib/scheduling'

const TYPE_LABELS: Record<string, string> = {
  schedule_service: 'Schedule Service',
  reschedule_or_cancel_service: 'Reschedule / Cancel Service',
  create_sqft_estimate: 'SQFT Estimate',
  schedule_estimate_visit: 'Estimate Visit',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#26BD97',
  rejected: '#f87171',
}

const SERVICE_TYPE_OPTIONS = [
  'Standard Clean', 'Deep Clean', 'Heavy Deep Clean', 'Office Clean',
  'Move In/Out', 'Touch Up', 'Construction Clean', 'Airbnb Clean',
  'Window Cleaning', 'Carpet Cleaning',
]
const ESTIMATE_TYPE_OPTIONS = ['Rough Clean', 'Final Clean', 'Touch Up']

function approveMessage(type: string, payload: any): string {
  switch (type) {
    case 'schedule_service':
      return `Hi! We've confirmed your ${payload?.type || 'cleaning'} for ${payload?.serviceDate} at ${payload?.serviceTime}. See you then!`
    case 'reschedule_or_cancel_service':
      return payload?.status === 'cancelled'
        ? `Hi! We've cancelled your cleaning as requested.`
        : `Hi! We've rescheduled your cleaning to ${payload?.serviceDate} at ${payload?.serviceTime}.`
    case 'schedule_estimate_visit':
      return `Hi! We've confirmed your estimate visit for ${payload?.visitDate} at ${payload?.visitTime}. See you then!`
    default:
      return ''
  }
}

function rejectMessage(): string {
  return `Hi! Unfortunately we're unable to accommodate that request right now. Please give us a call back so we can find another option.`
}

function isoToDDMMYYYY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso
}

function ddmmyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// Native <input type="date"> can't be forced to display DD-MM-YYYY across
// browsers, so this is a plain text field with its own draft state — only
// commits to the (YYYY-MM-DD) payload value once a full, valid date is typed.
function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [draft, setDraft] = useState(isoToDDMMYYYY(value || ''))
  useEffect(() => { setDraft(isoToDDMMYYYY(value || '')) }, [value])

  return (
    <input
      type="text"
      value={draft}
      onChange={e => {
        const v = e.target.value
        setDraft(v)
        const iso = ddmmyyyyToIso(v)
        if (iso) onChange(iso)
      }}
      placeholder="DD-MM-YYYY"
      className="w-full bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
    />
  )
}

type Field = { key: string; label: string; kind: 'text' | 'date' | 'select' | 'number'; options?: string[] }

function editableFieldsFor(type: string, payload: any): Field[] {
  switch (type) {
    case 'schedule_service':
      return [
        { key: 'type', label: 'Service type', kind: 'select', options: SERVICE_TYPE_OPTIONS },
        { key: 'serviceDate', label: 'Date', kind: 'date' },
        { key: 'serviceTime', label: 'Time', kind: 'select', options: HOURLY_SLOTS },
        { key: 'address', label: 'Address', kind: 'text' },
      ]
    case 'reschedule_or_cancel_service':
      return payload.status === 'cancelled' ? [] : [
        { key: 'serviceDate', label: 'New date', kind: 'date' },
        { key: 'serviceTime', label: 'New time', kind: 'select', options: HOURLY_SLOTS },
      ]
    case 'create_sqft_estimate':
      return [
        { key: 'type', label: 'Estimate type', kind: 'select', options: ESTIMATE_TYPE_OPTIONS },
        { key: 'sqft', label: 'Square feet', kind: 'number' },
        { key: 'address', label: 'Address', kind: 'text' },
      ]
    case 'schedule_estimate_visit':
      return [
        { key: 'visitDate', label: 'Date', kind: 'date' },
        { key: 'visitTime', label: 'Time', kind: 'select', options: HOURLY_SLOTS },
        { key: 'address', label: 'Address', kind: 'text' },
      ]
    default:
      return []
  }
}

// Read-only context shown alongside the editable fields (not sent back on approve).
function readOnlyRowsFor(type: string, payload: any): [string, any][] {
  switch (type) {
    case 'schedule_service':
      return [
        ['Frequency', payload.frequency || 'one_time'],
        ['New customer?', payload.isNewClient ? 'Yes' : 'No'],
        ['Estimated price', payload.estimatedPrice != null ? `$${payload.estimatedPrice}` : 'N/A'],
        ['Notes', payload.notes || '—'],
      ]
    case 'reschedule_or_cancel_service':
      return payload.status === 'cancelled' ? [['Action', 'Cancel'], ['Service ID', payload.serviceId]] : [['Action', 'Reschedule'], ['Service ID', payload.serviceId]]
    case 'create_sqft_estimate':
      return [['Estimated price', payload.estimatedPrice != null ? `$${payload.estimatedPrice}` : 'N/A'], ['Notes', payload.notes || '—']]
    case 'schedule_estimate_visit':
      return [['Notes', payload.notes || '—']]
    default:
      return []
  }
}

function EditableFields({ type, payload, onChange }: { type: string; payload: any; onChange: (key: string, value: any) => void }) {
  const fields = editableFieldsFor(type, payload)
  const readOnly = readOnlyRowsFor(type, payload)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {fields.map(f => (
        <div key={f.key}>
          <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">{f.label}</div>
          {f.kind === 'select' ? (
            <select
              value={payload[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="w-full bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
            >
              {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.kind === 'date' ? (
            <DateField value={payload[f.key] ?? ''} onChange={v => onChange(f.key, v)} />
          ) : (
            <input
              type={f.kind === 'number' ? 'number' : 'text'}
              value={payload[f.key] ?? ''}
              onChange={e => onChange(f.key, f.kind === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-full bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
            />
          )}
        </div>
      ))}
      {readOnly.map(([label, value]) => (
        <div key={label}>
          <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{label}</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">{String(value ?? '—')}</div>
        </div>
      ))}
    </div>
  )
}

export default function AiRequestModal({
  request, onClose, onResolve,
}: {
  request: any | null
  onClose: () => void
  onResolve: (id: string, body: { action: 'approve' | 'reject'; adminNotes: string; customerMessage: string; notifyCustomer: boolean; editedPayload: any }) => Promise<void>
}) {
  const [editedPayload, setEditedPayload] = useState<any>({})
  const [adminNotes, setAdminNotes] = useState('')
  const [customerMessage, setCustomerMessage] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!request) return
    setEditedPayload({ ...request.payload })
    setAdminNotes('')
    setCustomerMessage(approveMessage(request.type, request.payload))
    setNotifyCustomer(!!request.callerEmail && request.type !== 'create_sqft_estimate')
  }, [request])

  if (!request) return null

  const color = STATUS_COLORS[request.status] || '#6b7280'
  const isPending = request.status === 'pending'

  function updateField(key: string, value: any) {
    setEditedPayload((prev: any) => ({ ...prev, [key]: value }))
  }

  async function handle(action: 'approve' | 'reject') {
    setSaving(true)
    try {
      await onResolve(request.id, { action, adminNotes, customerMessage, notifyCustomer, editedPayload })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg p-6 shadow-[0_32px_100px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79,142,247,0.15)' }}>
              <Bot size={18} color="#4f8ef7" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#e8eaf0]">{TYPE_LABELS[request.type] || request.type}</div>
              <div className="text-[10px] text-[#6b7280]">{request.platform === 'vapi' ? 'Vapi' : request.platform === 'retell' ? 'Retell' : ''}</div>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${color}20`, color }}>
            {request.status}
          </span>
        </div>

        <div className="space-y-1 mb-4">
          <div className="text-xs text-[#9ca3af]">{request.summary}</div>
          <div className="text-xs text-[#6b7280]">
            {request.callerName || 'Unknown caller'} {request.callerPhone ? `· ${request.callerPhone}` : ''} {request.callerEmail ? `· ${request.callerEmail}` : ''}
          </div>
        </div>

        <div className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-3 mb-4">
          {isPending ? (
            <>
              <p className="text-[10px] text-[#6b7280] mb-2">Adjust anything below before approving — what gets booked is exactly what's shown here.</p>
              <EditableFields type={request.type} payload={editedPayload} onChange={updateField} />
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(request.payload || {}).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{label}</div>
                  <div className="text-xs text-[#e8eaf0] mt-0.5">
                    {/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? isoToDDMMYYYY(String(value)) : String(value ?? '—')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isPending ? (
          <>
            <div className="mb-3">
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Admin notes (internal only)</label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full mt-1 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-3 py-2 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
              />
            </div>

            {request.type !== 'create_sqft_estimate' && (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Message to customer</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCustomerMessage(approveMessage(request.type, editedPayload))}
                      className="text-[10px] text-[#6b7280] hover:text-[#26BD97] underline"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => setCustomerMessage(rejectMessage())}
                      className="text-[10px] text-[#6b7280] hover:text-[#f87171] underline"
                    >
                      Use rejection message
                    </button>
                  </div>
                </div>
                <textarea
                  value={customerMessage}
                  onChange={e => setCustomerMessage(e.target.value)}
                  rows={3}
                  className="w-full mt-1 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-3 py-2 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
                />
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyCustomer}
                    onChange={e => setNotifyCustomer(e.target.checked)}
                    disabled={!request.callerEmail}
                    className="accent-[#4f8ef7] w-3 h-3"
                  />
                  <span className="text-[10px] text-[#9ca3af]">
                    {request.callerEmail ? 'Send this message by email' : 'No email on file — cannot notify customer'}
                  </span>
                </label>
              </div>
            )}
            {request.type === 'create_sqft_estimate' && (
              <p className="text-[10px] text-[#6b7280] mb-3">Approving this sends the estimate PDF directly to the customer's email — no separate message needed.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handle('reject')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-[#f87171] text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all disabled:opacity-50"
              >
                <X size={13} />Reject
              </button>
              <button
                onClick={() => handle('approve')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white bg-[#26BD97] hover:bg-[#1fa382] transition-all disabled:opacity-50"
              >
                <Check size={13} />Approve
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-[#6b7280]">
              Resolved {request.resolvedAt ? new Date(request.resolvedAt).toLocaleString() : ''} by {request.resolvedBy?.name || 'staff'}
            </div>
            {request.adminNotes && <p className="text-xs text-[#9ca3af]"><b>Admin notes:</b> {request.adminNotes}</p>}
            {request.customerMessage && <p className="text-xs text-[#9ca3af]"><b>Customer message:</b> {request.customerMessage}</p>}
            <button onClick={onClose} className="w-full py-2 rounded-lg text-xs font-semibold border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all mt-2">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
