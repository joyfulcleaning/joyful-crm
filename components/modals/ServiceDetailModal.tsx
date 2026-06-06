'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Pencil, Save, Copy, Layers, DollarSign, Camera, Trash2, ZoomIn, ImagePlus, Repeat2 } from 'lucide-react'
import SelectWithAdd from '@/components/ui/SelectWithAdd'
import ServiceModal from './ServiceModal'

const SERVICE_TYPES = [
  'Standard Clean',
  'Deep Clean',
  'Heavy Deep Clean',
  'Office Clean',
  'Move In/Out',
  'Touch Up',
  'Construction Clean',
  'Airbnb Clean',
  'Cancellation Fee',
  'Inspection Fee',
  'Monthly Cleaning',
  'Biweekly Cleaning',
  'Weekly Cleaning',
]



const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  completed: '#38d9a9',
  cancelled: '#f87171',
}

const ROOM_SIZES = ['1BR', '2BR', '3BR', 'Office/Amenities', 'Other']

const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30
  const h24 = Math.floor(totalMinutes / 60)
  const m  = totalMinutes % 60
  const hh = String(h24).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return { value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` }
})

const ROOM_TO_KEY: Record<string, string> = {
  '1BR': 'std1BR',
  '2BR': 'std2BR',
  '3BR': 'std3BR',
}

const AUTO_PRICE_TYPES = new Set(['Standard Clean', 'Deep Clean', 'Heavy Deep Clean', 'Office Clean'])

const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

interface Props {
  service: any
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function calcPrices(client: any, type: string, roomSize: string) {
  const conds = client?.management?.priceConditions
  if (!conds) return null

  const stdKey = ROOM_TO_KEY[roomSize]
  const stdPrice = stdKey && conds[stdKey]?.active && conds[stdKey]?.value
    ? parseFloat(conds[stdKey].value) : null

  const officePrice = conds.office?.active && conds.office?.value
    ? parseFloat(conds.office.value)
    : conds.officeAlt?.active && conds.officeAlt?.value
    ? parseFloat(conds.officeAlt.value) : null

  if (type === 'Standard Clean') {
    if (roomSize === 'Office/Amenities') return officePrice != null ? { base: officePrice, fee: 0 } : null
    return stdPrice != null ? { base: stdPrice, fee: 0 } : null
  }
  if (type === 'Deep Clean') {
    if (stdPrice == null) return null
    const fee = conds.deepCleanFee?.active && conds.deepCleanFee?.value
      ? parseFloat(conds.deepCleanFee.value) : 0
    return { base: stdPrice, fee }
  }
  if (type === 'Heavy Deep Clean') {
    if (stdPrice == null) return null
    const fee = conds.hdcFee?.active && conds.hdcFee?.value
      ? parseFloat(conds.hdcFee.value) : 0
    return { base: stdPrice, fee }
  }
  if (type === 'Office Clean') {
    return officePrice != null ? { base: officePrice, fee: 0 } : null
  }
  return null
}

function fmtDate(raw: string | undefined) {
  if (!raw) return '—'
  const [y, m, d] = raw.split('T')[0].split('-')
  return `${m}/${d}/${y}`
}

export default function ServiceDetailModal({ service, open, onClose, onSuccess }: Props) {
  const isDuplicate = service?._isDuplicate === true
  const isSeriesMember = !isDuplicate && !!(service?.parentServiceId || (service?._count?.duplicates ?? 0) > 0)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [pricedFromMgmt, setPricedFromMgmt] = useState(false)
  const [recurOpen, setRecurOpen] = useState(false)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)

  // ── Photos ──
  const [photos, setPhotos] = useState<any[]>([])
  const [photoTab, setPhotoTab] = useState<'before' | 'after'>('before')
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/staff').then(r => r.json()).catch(() => []),
    ]).then(([c, s]) => {
      setClients(c)
      const ORDER = ['Taymie', 'Jenifer', 'Lizyanis', 'Melsy', 'Nathasha', 'Admin', 'Seidy', 'Seydi']
      setStaff([...s].sort((a, b) => {
        const ai = ORDER.findIndex(n => a.name?.startsWith(n))
        const bi = ORDER.findIndex(n => b.name?.startsWith(n))
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      }))
    })
  }, [open])

  // Load photos when modal opens for a real service
  useEffect(() => {
    if (!open || !service?.id || isDuplicate) return
    fetch(`/api/services/${service.id}/photos`)
      .then(r => r.json())
      .then(data => setPhotos(Array.isArray(data) ? data : []))
      .catch(() => setPhotos([]))
  }, [open, service?.id, isDuplicate])

  async function handleUploadPhoto(files: FileList | null) {
    if (!files || !service?.id) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', photoTab)
        const res = await fetch(`/api/services/${service.id}/photos`, { method: 'POST', body: fd })
        if (res.ok) {
          const photo = await res.json()
          setPhotos(prev => [...prev, photo])
        }
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!service?.id) return
    const res = await fetch(`/api/services/${service.id}/photos/${photoId}`, { method: 'DELETE' })
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  // Auto-start editing for duplicates
  useEffect(() => {
    if (open && isDuplicate && service) {
      setForm({
        ...service,
        serviceDate: service.serviceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        staffIds: service.staff?.map((st: any) => st.userId) || [],
      })
      setEditing(true)
    }
  }, [open, isDuplicate, service])

  // Auto-price in edit mode when client / type / roomSize changes
  useEffect(() => {
    if (!editing || !form?.clientId || !form?.roomSize || !AUTO_PRICE_TYPES.has(form?.type)) {
      return
    }
    const client = clients.find(c => c.id === form.clientId)
    const result = calcPrices(client, form.type, form.roomSize)
    if (result) {
      setForm((f: any) => ({
        ...f,
        basePrice: result.base.toString(),
        additionalFee: result.fee > 0 ? result.fee.toString() : '',
      }))
      setPricedFromMgmt(true)
    } else {
      setPricedFromMgmt(false)
    }
  }, [form?.clientId, form?.type, form?.roomSize, clients, editing])

  function startEdit() {
    setForm({
      ...service,
      serviceDate: service.serviceDate?.split('T')[0],
      staffIds: service.staff?.map((st: any) => st.userId) || [],
    })
    setPricedFromMgmt(false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm(null)
    setError('')
    setPricedFromMgmt(false)
    if (isDuplicate) onClose()
  }

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  function toggleStaff(id: string) {
    setForm((f: any) => ({
      ...f,
      staffIds: f.staffIds.includes(id)
        ? f.staffIds.filter((s: string) => s !== id)
        : [...f.staffIds, id]
    }))
  }

  const total = form ? (parseFloat(form.basePrice) || 0) + (parseFloat(form.additionalFee) || 0) : 0

  function handleSaveClick() {
    if (isSeriesMember) {
      setSeriesDialogOpen(true)
    } else {
      handleSave(false)
    }
  }

  async function handleSave(applyToSeries: boolean) {
    setSeriesDialogOpen(false)
    setLoading(true)
    setError('')
    try {
      if (isDuplicate) {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: form.clientId,
            type: form.type,
            serviceDate: form.serviceDate,
            serviceTime: form.serviceTime,
            address: form.address,
            unit: form.unit,
            roomSize: form.roomSize,
            frequency: form.frequency,
            basePrice: parseFloat(form.basePrice),
            additionalFee: parseFloat(form.additionalFee) || 0,
            total,
            paymentMethod: form.paymentMethod,
            status: 'pending',
            notes: form.internalNotes,
            staffIds: form.staffIds || [],
          })
        })
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch(`/api/services/${service.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, total, applyToSeries })
        })
        if (!res.ok) throw new Error()
      }
      onSuccess()
      onClose()
      setEditing(false)
      setForm(null)
    } catch {
      setError(isDuplicate ? 'Failed to create service.' : 'Failed to update service.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !service) return null

  const data = editing ? form : service
  const statusColor = STATUS_COLORS[data?.status] || '#6b7280'

  const selectedClient = clients.find(c => c.id === form?.clientId)
  const hasMgmt = editing && !!selectedClient?.management
  const mgmtName = selectedClient?.management?.name

  const feeLabel =
    form?.type === 'Deep Clean' ? 'Deep Clean Fee' :
    form?.type === 'Heavy Deep Clean' ? 'HDC Fee' :
    'Additional Fee'

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              {isDuplicate ? (
                <>
                  <Copy size={14} className="text-[#38d9a9]" />
                  <span className="text-sm font-bold text-[#38d9a9]">Duplicate Service</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[var(--text)]">Service</span>
                  <span className="text-sm font-bold text-[var(--accent)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    #{service.serviceNumber}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                  >
                    {data?.status?.replace('_', ' ')}
                  </span>
                </>
              )}
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">
              {isDuplicate
                ? 'Review and modify before saving'
                : `${service.client?.name} · ${fmtDate(service.serviceDate)}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && !isDuplicate && (
              <button
                onClick={() => setRecurOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[#38d9a9] hover:border-[#38d9a9] transition-all"
                title="Create recurring services based on this one"
              >
                <Repeat2 size={12} /> Recurrence
              </button>
            )}
            {!editing && !isDuplicate ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
              >
                <Pencil size={12} /> Edit
              </button>
            ) : editing ? (
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-all"
              >
                Cancel
              </button>
            ) : null}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Client + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Client</label>
              {editing ? (
                <>
                  <select
                    value={form.clientId}
                    onChange={e => set('clientId', e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {hasMgmt && (
                    <div className="flex items-center gap-1 mt-1">
                      <Layers size={9} className="text-[var(--accent)]" />
                      <span className="text-[10px] text-[var(--accent)]">{mgmtName}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-[var(--text)]">{data.client?.name || '—'}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Type</label>
              {editing ? (
                <SelectWithAdd
                  value={form.type}
                  onChange={v => set('type', v)}
                  options={SERVICE_TYPES}
                  storageKey="serviceType"
                  addLabel="service type"
                  capitalize={false}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <div className="text-xs text-[var(--text)]">{data.type || '—'}</div>
              )}
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Date</label>
              {editing ? (
                <input
                  type="date"
                  value={form.serviceDate}
                  onChange={e => set('serviceDate', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <div className="text-xs text-[var(--text)]">{fmtDate(data.serviceDate)}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Time</label>
              {editing ? (
                <select
                  value={form.serviceTime}
                  onChange={e => set('serviceTime', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Select time…</option>
                  {TIME_SLOTS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-[var(--text)]">{data.serviceTime || '—'}</div>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Address</label>
            {editing ? (
              <input
                type="text"
                value={form.address || ''}
                onChange={e => set('address', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            ) : (
              <div className="text-xs text-[var(--text)]">{data.address || '—'}</div>
            )}
          </div>

          {/* Unit + Room Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Unit</label>
              {editing ? (
                <input
                  type="text"
                  value={form.unit || ''}
                  onChange={e => set('unit', e.target.value)}
                  placeholder="Apt 2B, Unit 101..."
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <div className="text-xs text-[var(--text)]">{data.unit || '—'}</div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Room Size</label>
              {editing ? (
                <SelectWithAdd
                  value={form.roomSize || ''}
                  onChange={v => set('roomSize', v)}
                  options={ROOM_SIZES}
                  storageKey="roomSize"
                  placeholder="Select size..."
                  addLabel="room size"
                  capitalize={false}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <div className="text-xs text-[var(--text)]">{data.roomSize || '—'}</div>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Frequency</label>
              {editing ? (
                <select
                  value={form.frequency || 'one_time'}
                  onChange={e => set('frequency', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              ) : (
                <div className="text-xs text-[var(--text)]">{data.frequency?.replace('_', '-') || '—'}</div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div>
            {editing && (
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Pricing</label>
                {pricedFromMgmt && mgmtName && (
                  <div className="flex items-center gap-1">
                    <DollarSign size={9} className="text-[var(--accent)]" />
                    <span className="text-[10px] text-[var(--accent)]">Auto-filled from {mgmtName}</span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Base Price</label>
                {editing ? (
                  <div className={`relative rounded-lg border transition-all ${pricedFromMgmt ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                    <input
                      type="number"
                      value={form.basePrice}
                      onChange={e => { set('basePrice', e.target.value); setPricedFromMgmt(false) }}
                      className="w-full pl-6 pr-3 py-2 bg-[var(--surface2)] rounded-lg text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text)]">${data.basePrice}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                  {editing ? feeLabel : 'Additional Fee'}
                </label>
                {editing ? (
                  <div className={`relative rounded-lg border transition-all ${
                    pricedFromMgmt && parseFloat(form.additionalFee) > 0 ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                  }`}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                    <input
                      type="number"
                      value={form.additionalFee || ''}
                      onChange={e => set('additionalFee', e.target.value)}
                      className="w-full pl-6 pr-3 py-2 bg-[var(--surface2)] rounded-lg text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text)]">{data.additionalFee ? `$${data.additionalFee}` : '—'}</div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Total</label>
                {editing ? (
                  <div className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs font-bold text-[#38d9a9]">
                    ${total.toFixed(2)}
                  </div>
                ) : (
                  <div className="text-xs font-bold text-[#38d9a9]">${data.total}</div>
                )}
              </div>
            </div>

            {/* Breakdown hint */}
            {editing && pricedFromMgmt && (form?.type === 'Deep Clean' || form?.type === 'Heavy Deep Clean') && form?.basePrice && form?.additionalFee && (
              <div className="mt-2 text-[10px] text-[var(--muted)] bg-[rgba(74,63,176,0.06)] border border-[rgba(74,63,176,0.15)] rounded-lg px-3 py-2">
                Base (STD {form.roomSize}) <span className="text-[var(--text)]">${form.basePrice}</span>
                {' '}+ {form.type === 'Deep Clean' ? 'Deep Clean' : 'HDC'} Fee <span className="text-[var(--text)]">${form.additionalFee}</span>
                {' '}= <span className="text-[#38d9a9] font-bold">${total.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Status</label>
              {editing ? (
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {data.status?.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Staff */}
          {editing ? (
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-2">Assign Staff</label>
              <div className="flex flex-wrap gap-2">
                {staff.map(member => {
                  const selected = form.staffIds?.includes(member.id)
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleStaff(member.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                          : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {member.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Staff</label>
              <div className="text-xs text-[var(--text)]">
                {data.staff?.length > 0
                  ? data.staff.map((st: any) => st.user?.name).join(', ')
                  : '—'}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Internal Notes</label>
            {editing ? (
              <textarea
                value={form.internalNotes || ''}
                onChange={e => set('internalNotes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            ) : (
              <div className="text-xs text-[var(--muted)]">{data.internalNotes || '—'}</div>
            )}
          </div>

          {!editing && data.staffNotes && (
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Notes for Staff</label>
              <div className="text-xs text-[var(--muted)]">{data.staffNotes}</div>
            </div>
          )}
          {editing && (
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Notes for Staff</label>
              <textarea
                value={form.staffNotes || ''}
                onChange={e => set('staffNotes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
          )}

          {/* ── Photos section (non-duplicate services only) ── */}
          {!isDuplicate && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                  Service Photos
                </label>
                <div className="flex items-center gap-2">
                  {/* Before / After tabs */}
                  {(['before', 'after'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPhotoTab(t)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full capitalize border transition-all ${
                        photoTab === t
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                          : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {/* Gallery upload */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Upload from gallery"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] disabled:opacity-50 text-[var(--text)] text-[10px] font-bold rounded-lg transition-all"
                  >
                    <ImagePlus size={11} />
                    Gallery
                  </button>
                  {/* Camera capture */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading}
                    title="Take a photo"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-all"
                  >
                    <Camera size={11} />
                    {uploading ? 'Uploading…' : 'Camera'}
                  </button>
                  {/* Hidden: gallery (multiple files) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleUploadPhoto(e.target.files)}
                  />
                  {/* Hidden: camera capture */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handleUploadPhoto(e.target.files)}
                  />
                </div>
              </div>

              {/* Photo grid */}
              {(() => {
                const visible = photos.filter(p => p.type === photoTab)
                return visible.length === 0 ? (
                  <div className="border-2 border-dashed border-[var(--border)] rounded-xl py-8 flex flex-col items-center justify-center gap-4">
                    <Camera size={24} className="text-[var(--muted)]" />
                    <span className="text-xs text-[var(--muted)]">No {photoTab} photos yet</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold rounded-lg transition-all"
                      >
                        <ImagePlus size={13} /> Upload from gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all"
                      >
                        <Camera size={13} /> Take photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {visible.map(photo => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-[var(--surface2)]">
                        <img
                          src={photo.url}
                          alt={`${photoTab} photo`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setLightbox(photo.url)}
                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all"
                          >
                            <ZoomIn size={14} className="text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg backdrop-blur-sm transition-all"
                          >
                            <Trash2 size={14} className="text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add more tile — shows both options */}
                    <div className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"
                        title="Upload from gallery"
                      >
                        <ImagePlus size={16} />
                        <span className="text-[9px] font-bold uppercase tracking-wide">Gallery</span>
                      </button>
                      <div className="w-8 h-px bg-[var(--border)]" />
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"
                        title="Take a photo"
                      >
                        <Camera size={16} />
                        <span className="text-[9px] font-bold uppercase tracking-wide">Camera</span>
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <img
              src={lightbox}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <X size={20} className="text-white" />
            </button>
          </div>
        )}

        {/* Footer */}
        {editing && (
          <div className="sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-[var(--muted)]">
              {isDuplicate && '📋 New service based on duplicate'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={isDuplicate ? () => handleSave(false) : handleSaveClick}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                <Save size={13} />
                {loading ? 'Saving...' : isDuplicate ? 'Create Service' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    <ServiceModal
      open={recurOpen}
      onClose={() => setRecurOpen(false)}
      onSuccess={() => { setRecurOpen(false); onSuccess() }}
      initialService={service}
    />

    {/* Series edit dialog */}
    {seriesDialogOpen && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSeriesDialogOpen(false)} />
        <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-[0_32px_80px_rgba(0,0,0,0.7)] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(74,63,176,0.15)] flex items-center justify-center shrink-0">
              <Repeat2 size={16} className="text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text)]">Edit Recurring Series</div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">This service belongs to a recurring series</div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="w-full text-left px-4 py-3.5 bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border)] hover:border-[var(--muted)] rounded-xl transition-all disabled:opacity-50"
            >
              <div className="text-xs font-semibold text-[var(--text)]">This service only</div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">
                Update only service #{service.serviceNumber}
              </div>
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="w-full text-left px-4 py-3.5 bg-[rgba(74,63,176,0.08)] hover:bg-[rgba(74,63,176,0.12)] border border-[var(--accent)] rounded-xl transition-all disabled:opacity-50"
            >
              <div className="text-xs font-semibold text-[var(--accent)]">This and all future services</div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">
                Apply changes to all upcoming services in the series
              </div>
            </button>
          </div>

          <button
            onClick={() => setSeriesDialogOpen(false)}
            className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--text)] py-1 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    </>
  )
}
