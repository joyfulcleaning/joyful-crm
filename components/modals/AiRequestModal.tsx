'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, X, Calendar as CalendarIcon } from 'lucide-react'
import { HOURLY_SLOTS } from '@/lib/scheduling'

const TYPE_LABELS: Record<string, string> = {
  schedule_service: 'Schedule Service',
  reschedule_or_cancel_service: 'Reschedule / Cancel Service',
  create_sqft_estimate: 'SQFT Estimate',
  schedule_estimate_visit: 'Estimate Visit',
  needs_followup: 'Needs Follow-up',
  quote_request: 'Quote Request',
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
const ROOM_SIZE_OPTIONS = ['1BR', '2BR', '3BR', 'Office/Amenities', 'Other']

// Types whose location is a real property (used for booking/visiting), so
// they get the structured Street/City/State/Zip + computed full-address
// fields. create_sqft_estimate keeps a single address field — its Estimate
// record has no separate columns and never shows up on the Services map.
const ADDRESS_TYPES = new Set(['schedule_service', 'schedule_estimate_visit'])

// Types with no automated customer-facing action on approve/reject — either
// because they send their own PDF (create_sqft_estimate) or because nothing
// was ever confirmed enough to tell the customer anything (needs_followup,
// where staff are expected to call them back instead).
const NO_CUSTOMER_MESSAGE_TYPES = new Set(['create_sqft_estimate', 'needs_followup'])

function firstNameOf(fullName?: string | null): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there'
}

function composeAddress(street?: string, city?: string, state?: string, zip?: string): string {
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [street, cityStateZip].filter(Boolean).join(', ')
}

function approveMessage(type: string, payload: any, callerName?: string | null): string {
  const name = firstNameOf(callerName)
  switch (type) {
    case 'schedule_service':
      return `Hi ${name}! We've confirmed your ${payload?.type || 'cleaning'} for ${payload?.serviceDate} at ${payload?.serviceTime}. See you then!`
    case 'reschedule_or_cancel_service':
      return payload?.status === 'cancelled'
        ? `Hi ${name}! We've cancelled your cleaning as requested.`
        : `Hi ${name}! We've rescheduled your cleaning to ${payload?.serviceDate} at ${payload?.serviceTime}.`
    case 'schedule_estimate_visit':
      return `Hi ${name}! We've confirmed your estimate visit for ${payload?.visitDate} at ${payload?.visitTime}. See you then!`
    case 'needs_followup':
      switch (payload?.requestType) {
        case 'schedule_service':
          return `Hi ${name}! We've confirmed your ${payload?.serviceType || 'cleaning'} for ${payload?.serviceDate} at ${payload?.serviceTime}. See you then!`
        case 'schedule_estimate_visit':
          return `Hi ${name}! We've confirmed your estimate visit for ${payload?.visitDate} at ${payload?.visitTime}. See you then!`
        default:
          return ''
      }
    case 'quote_request':
      return `Hi ${name}! Thanks for requesting a quote from Joyful Cleaning Services. We'll follow up shortly with pricing.`
    default:
      return ''
  }
}

function rejectMessage(callerName?: string | null): string {
  const name = firstNameOf(callerName)
  return `Hi ${name}! Unfortunately we're unable to accommodate that request right now. Please give us a call back so we can find another option.`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${mm}-${dd}-${yyyy} ${time}`
}

function isoToMMDDYYYY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[2]}-${m[3]}-${m[1]}` : iso
}

function mmddyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function MiniCalendar({ value, onSelect, onClose }: { value: string; onSelect: (date: string) => void; onClose: () => void }) {
  const initDate = value ? new Date(`${value}T12:00:00Z`) : new Date()
  const [year, setYear] = useState(initDate.getUTCFullYear())
  const [month, setMonth] = useState(initDate.getUTCMonth())

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const selectedDay = value?.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) ? Number(value.slice(8, 10)) : null

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const pick = (d: number) => {
    onSelect(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    onClose()
  }

  return (
    <div className="absolute z-10 mt-1 bg-[#161922] border border-[#2a2f3d] rounded-xl p-3 shadow-xl w-60">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="text-[#9ca3af] hover:text-[#e8eaf0] px-1">‹</button>
        <div className="text-xs font-bold text-[#e8eaf0]">{MONTHS[month]} {year}</div>
        <button type="button" onClick={nextMonth} className="text-[#9ca3af] hover:text-[#e8eaf0] px-1">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-[9px] text-[#6b7280] font-bold">{d}</div>)}
        {cells.map((d, i) => (
          <button
            type="button"
            key={i}
            disabled={d == null}
            onClick={() => d && pick(d)}
            className={`text-[10px] rounded-md py-1 ${d == null ? '' : d === selectedDay ? 'bg-[#4f8ef7] text-white' : 'text-[#9ca3af] hover:bg-[#252b3b]'}`}
          >
            {d ?? ''}
          </button>
        ))}
      </div>
    </div>
  )
}

// Native <input type="date"> can't be forced to display MM-DD-YYYY across
// browsers, so this is a plain text field with its own draft state (only
// commits a value once a full, valid date is typed) plus a calendar popup
// as a click-to-pick shortcut for the same field.
function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [draft, setDraft] = useState(isoToMMDDYYYY(value || ''))
  const [showCal, setShowCal] = useState(false)
  useEffect(() => { setDraft(isoToMMDDYYYY(value || '')) }, [value])

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={e => {
            const v = e.target.value
            setDraft(v)
            const iso = mmddyyyyToIso(v)
            if (iso) onChange(iso)
          }}
          placeholder="MM-DD-YYYY"
          className="flex-1 w-full bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-2 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
        />
        <button
          type="button"
          onClick={() => setShowCal(v => !v)}
          className="px-2 rounded-lg border border-[#2a2f3d] text-[#9ca3af] hover:text-[#4f8ef7] hover:border-[#4f8ef7]"
        >
          <CalendarIcon size={14} />
        </button>
      </div>
      {showCal && <MiniCalendar value={value} onSelect={d => onChange(d)} onClose={() => setShowCal(false)} />}
    </div>
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
        { key: 'street', label: 'Street', kind: 'text' },
        { key: 'city', label: 'City', kind: 'text' },
        { key: 'state', label: 'State', kind: 'text' },
        { key: 'zip', label: 'Zip', kind: 'text' },
        { key: 'unit', label: 'Unit (if apartment)', kind: 'text' },
        { key: 'roomSize', label: 'Room size', kind: 'select', options: ROOM_SIZE_OPTIONS },
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
        { key: 'street', label: 'Street', kind: 'text' },
        { key: 'city', label: 'City', kind: 'text' },
        { key: 'state', label: 'State', kind: 'text' },
        { key: 'zip', label: 'Zip', kind: 'text' },
      ]
    case 'needs_followup':
      // Uses the canonical extraction field names directly (serviceType,
      // address, callerName...) instead of each request*()'s own renamed
      // args — that mapping only happens server-side, in mapFollowUpPayload,
      // right before "complete" actually calls createService()/etc.
      switch (payload.requestType) {
        case 'schedule_service':
          return [
            { key: 'serviceType', label: 'Service type', kind: 'select', options: SERVICE_TYPE_OPTIONS },
            { key: 'serviceDate', label: 'Date', kind: 'date' },
            { key: 'serviceTime', label: 'Time', kind: 'select', options: HOURLY_SLOTS },
            { key: 'address', label: 'Street', kind: 'text' },
            { key: 'city', label: 'City', kind: 'text' },
            { key: 'state', label: 'State', kind: 'text' },
            { key: 'zip', label: 'Zip', kind: 'text' },
            { key: 'unit', label: 'Unit (if apartment)', kind: 'text' },
            { key: 'roomSize', label: 'Room size', kind: 'select', options: ROOM_SIZE_OPTIONS },
            { key: 'callerName', label: 'Caller name', kind: 'text' },
            { key: 'callerPhone', label: 'Caller phone', kind: 'text' },
          ]
        case 'create_sqft_estimate':
          return [
            { key: 'serviceType', label: 'Estimate type', kind: 'select', options: ESTIMATE_TYPE_OPTIONS },
            { key: 'sqft', label: 'Square feet', kind: 'number' },
            { key: 'address', label: 'Address', kind: 'text' },
            { key: 'callerName', label: 'Caller name', kind: 'text' },
            { key: 'callerEmail', label: 'Caller email', kind: 'text' },
          ]
        case 'schedule_estimate_visit':
          return [
            { key: 'visitDate', label: 'Date', kind: 'date' },
            { key: 'visitTime', label: 'Time', kind: 'select', options: HOURLY_SLOTS },
            { key: 'address', label: 'Street', kind: 'text' },
            { key: 'city', label: 'City', kind: 'text' },
            { key: 'state', label: 'State', kind: 'text' },
            { key: 'zip', label: 'Zip', kind: 'text' },
            { key: 'callerName', label: 'Caller name', kind: 'text' },
            { key: 'callerPhone', label: 'Caller phone', kind: 'text' },
          ]
        default:
          return []
      }
    default:
      return []
  }
}

// requestTypes a needs_followup can be turned into a real record for, via
// the "complete" action — reschedule/cancel is excluded because it needs a
// real serviceId from list_client_services, which a needs_followup almost
// never has (that's usually exactly why it fell through to needs_followup).
const COMPLETABLE_FOLLOWUP_TYPES: Record<string, string> = {
  schedule_service: 'Create Service',
  create_sqft_estimate: 'Create Estimate',
  schedule_estimate_visit: 'Create Estimate Visit',
}

// Read-only context shown alongside the editable fields (not sent back on approve).
function readOnlyRowsFor(type: string, payload: any): [string, any][] {
  switch (type) {
    case 'schedule_service':
      return [
        ['Full address', payload.address || '—'],
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
      return [['Full address', payload.address || '—'], ['Notes', payload.notes || '—']]
    case 'quote_request':
      return [
        ['Service needed', payload.serviceNeeded || '—'],
        ['Preferred date', payload.preferredDate || '—'],
        ['Notes', payload.notes || '—'],
      ]
    case 'needs_followup': {
      const p = payload || {}
      const fmtDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? isoToMMDDYYYY(String(v)) : v
      const rows: [string, any][] = []
      if (p.requestType && p.requestType !== 'none') rows.push(['Looked like', TYPE_LABELS[p.requestType] || p.requestType])
      // The fields covered by editableFieldsFor for this requestType are
      // edited above instead of repeated here — only show the rest of what
      // was captured (and, if there's no edit path at all, everything).
      if (!COMPLETABLE_FOLLOWUP_TYPES[p.requestType]) {
        if (p.serviceType) rows.push(['Service type', p.serviceType])
        if (p.address) rows.push(['Address', p.address])
        if (p.unit) rows.push(['Unit', p.unit])
        if (p.city || p.state || p.zip) rows.push(['City / State / Zip', [p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')])
        if (p.roomSize) rows.push(['Room size', p.roomSize])
        if (p.serviceDate) rows.push(['Date', fmtDate(p.serviceDate)])
        if (p.serviceTime) rows.push(['Time', p.serviceTime])
        if (p.visitDate) rows.push(['Visit date', fmtDate(p.visitDate)])
        if (p.visitTime) rows.push(['Visit time', p.visitTime])
        if (p.sqft) rows.push(['Square feet', p.sqft])
      }
      if (p.frequency) rows.push(['Frequency', p.frequency])
      if (p.serviceId) rows.push(['Service ID (reschedule/cancel)', p.serviceId])
      if (typeof p.cancel === 'boolean') rows.push(['Wanted to cancel?', p.cancel ? 'Yes' : 'No'])
      if (p.notes) rows.push(['Notes', p.notes])
      if (p.reason) rows.push(['Why it needs follow-up', p.reason])
      return rows
    }
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
  onResolve: (id: string, body: { action: 'approve' | 'reject' | 'complete'; adminNotes: string; customerMessage: string; notifyCustomer: boolean; editedPayload: any }) => Promise<void>
}) {
  const [editedPayload, setEditedPayload] = useState<any>({})
  const [adminNotes, setAdminNotes] = useState('')
  const [customerMessage, setCustomerMessage] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!request) return
    const p = { ...request.payload }
    if (ADDRESS_TYPES.has(request.type)) {
      p.street = p.street ?? p.address ?? ''
      p.address = composeAddress(p.street, p.city, p.state, p.zip)
    }
    setEditedPayload(p)
    setAdminNotes('')
    setCustomerMessage(approveMessage(request.type, request.payload, request.callerName))
    const isNotifiableFollowup = request.type === 'needs_followup' && (p.requestType === 'schedule_service' || p.requestType === 'schedule_estimate_visit')
    setNotifyCustomer(!!request.callerEmail && (!NO_CUSTOMER_MESSAGE_TYPES.has(request.type) || isNotifiableFollowup))
  }, [request])

  if (!request) return null

  const color = STATUS_COLORS[request.status] || '#6b7280'
  const isPending = request.status === 'pending'
  const showCustomerMessageSection = request.type === 'needs_followup'
    ? (editedPayload.requestType === 'schedule_service' || editedPayload.requestType === 'schedule_estimate_visit')
    : !NO_CUSTOMER_MESSAGE_TYPES.has(request.type)

  function updateField(key: string, value: any) {
    setEditedPayload((prev: any) => {
      const next = { ...prev, [key]: value }
      if (ADDRESS_TYPES.has(request.type) && ['street', 'city', 'state', 'zip'].includes(key)) {
        next.address = composeAddress(next.street, next.city, next.state, next.zip)
      }
      return next
    })
  }

  async function handle(action: 'approve' | 'reject' | 'complete') {
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${color}20`, color }}>
              {request.status}
            </span>
            <button onClick={onClose} className="p-1 rounded text-[#6b7280] hover:text-[#e8eaf0] hover:bg-white/5 transition-all">
              <X size={16} />
            </button>
          </div>
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
              <p className="text-[10px] text-[#6b7280] mb-2">
                {request.type === 'needs_followup'
                  ? (COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType]
                      ? `Confirm/adjust below, then "${COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType]}" once it's all there — or Approve to just mark it handled without creating anything.`
                      : "Whatever the caller confirmed during the call — call them back to take it from here.")
                  : "Adjust anything below before approving — what gets booked is exactly what's shown here."}
              </p>
              <EditableFields type={request.type} payload={editedPayload} onChange={updateField} />
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(request.payload || {}).map(([label, value]) => (
                <div key={label}>
                  <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{label}</div>
                  <div className="text-xs text-[#e8eaf0] mt-0.5">
                    {/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? isoToMMDDYYYY(String(value)) : String(value ?? '—')}
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

            {showCustomerMessageSection && (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Message to customer</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCustomerMessage(approveMessage(request.type, editedPayload, request.callerName))}
                      className="text-[10px] text-[#6b7280] hover:text-[#26BD97] underline"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => setCustomerMessage(rejectMessage(request.callerName))}
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
            {(request.type === 'create_sqft_estimate' || (request.type === 'needs_followup' && editedPayload.requestType === 'create_sqft_estimate')) && (
              <p className="text-[10px] text-[#6b7280] mb-3">{request.type === 'needs_followup' ? 'Using "Create Estimate" below sends' : 'Approving this sends'} the estimate PDF directly to the customer's email — no separate message needed.</p>
            )}
            {request.type === 'needs_followup' && (
              <p className="text-[10px] text-[#6b7280] mb-3">
                {COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType]
                  ? `Approve only marks this handled — it won't create anything by itself. Use "${COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType]}" below for that.`
                  : 'Nothing to execute here — call the customer back to confirm details, then mark this Approved (handled) or Rejected (turned out to be nothing).'}
              </p>
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
            {request.type === 'needs_followup' && COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType] && (
              <button
                onClick={() => handle('complete')}
                disabled={saving}
                className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white bg-[#4f8ef7] hover:bg-[#3a7ee0] transition-all disabled:opacity-50"
              >
                <Check size={13} />{COMPLETABLE_FOLLOWUP_TYPES[editedPayload.requestType]}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="text-[10px] text-[#6b7280]">
              Resolved {request.resolvedAt ? formatDateTime(request.resolvedAt) : ''} by {request.resolvedBy?.name || 'staff'}
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
