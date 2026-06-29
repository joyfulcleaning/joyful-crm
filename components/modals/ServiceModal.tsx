'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Plus, Mail, Layers, DollarSign, Info } from 'lucide-react'
import { PRIVATE_CUSTOMER_NAME } from './ManagementModal'
import ClientModal from './ClientModal'
import SelectWithAdd from '@/components/ui/SelectWithAdd'
import { calcPrices, calcPrivatePrices, AUTO_PRICE_TYPES } from '@/lib/pricing'

const SERVICE_TYPES = [
  'Standard Clean',
  'Deep Clean',
  'Heavy Deep Clean',
  'Office Clean',
  'Move In/Out',
  'Touch Up',
  'Construction Clean',
  'Airbnb Clean',
  'Window Cleaning',
  'Carpet Cleaning',
  'Cancellation Fee',
  'Inspection Fee',
  'Monthly Cleaning',
  'Biweekly Cleaning',
  'Weekly Cleaning',
]

const ROOM_SIZES = ['1BR', '2BR', '3BR', 'Office/Amenities', 'Other']

// 30-min slots 7:00 AM – 9:00 PM stored as "HH:mm" (24h)
export const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30
  const h24 = Math.floor(totalMinutes / 60)
  const m  = totalMinutes % 60
  const hh = String(h24).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return { value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` }
})

const FREQUENCIES = [
  { value: 'one_time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function generateDates(
  startDate: string,
  frequency: string,
  recurDays: number[],
  recurMonthDays: number[],
  endType: 'date' | 'count',
  endDate: string,
  count: number,
  monthlyMode: 'dayOfMonth' | 'nthWeekday' = 'dayOfMonth',
  nthOrdinal: number = 1,
  nthWeekday: number = 0,
): string[] {
  const dates: string[] = []
  if (!startDate) return dates
  const start = new Date(startDate + 'T12:00:00Z')

  if (frequency === 'weekly' || frequency === 'biweekly') {
    if (recurDays.length === 0) return dates
    const interval = frequency === 'biweekly' ? 14 : 7
    const maxDate  = endType === 'date' && endDate ? new Date(endDate + 'T23:59:59Z') : null
    const maxCount = endType === 'count' ? count : 366
    // Rewind to the Sunday of the week containing startDate
    const weekStart = new Date(start)
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
    for (let w = 0; w < 200 && dates.length < maxCount; w++) {
      const ws = new Date(weekStart)
      ws.setUTCDate(ws.getUTCDate() + w * interval)
      for (const day of [...recurDays].sort()) {
        if (dates.length >= maxCount) break
        const d = new Date(ws)
        d.setUTCDate(d.getUTCDate() + day)
        if (d < start) continue
        if (maxDate && d > maxDate) return dates
        dates.push(d.toISOString().split('T')[0])
      }
    }
  } else if (frequency === 'monthly') {
    const maxDate  = endType === 'date' && endDate ? new Date(endDate + 'T23:59:59Z') : null
    const maxCount = endType === 'count' ? count : 120

    if (monthlyMode === 'nthWeekday') {
      // e.g. "the 2nd Sunday of every month" — skip a month entirely if it
      // doesn't have that many occurrences (e.g. a "5th Friday").
      // nthOrdinal === -1 means "last", counted backward from month end instead.
      let y = start.getUTCFullYear(), m = start.getUTCMonth()
      for (let iter = 0; iter < 120 && dates.length < maxCount; iter++) {
        const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        const day = nthOrdinal === -1
          ? dim - ((new Date(Date.UTC(y, m, dim)).getUTCDay() - nthWeekday + 7) % 7)
          : 1 + ((nthWeekday - new Date(Date.UTC(y, m, 1)).getUTCDay() + 7) % 7) + (nthOrdinal - 1) * 7
        if (day >= 1 && day <= dim) {
          const d = new Date(Date.UTC(y, m, day))
          if (d >= start) {
            if (maxDate && d > maxDate) return dates
            dates.push(d.toISOString().split('T')[0])
          }
        }
        m++; if (m > 11) { m = 0; y++ }
      }
      return dates
    }

    if (recurMonthDays.length === 0) return dates
    let y = start.getUTCFullYear(), m = start.getUTCMonth()
    for (let iter = 0; iter < 60 && dates.length < maxCount; iter++) {
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      for (const day of [...recurMonthDays].sort((a, b) => a - b)) {
        if (dates.length >= maxCount) break
        const d = new Date(Date.UTC(y, m, Math.min(day, dim)))
        if (d < start) continue
        if (maxDate && d > maxDate) return dates
        dates.push(d.toISOString().split('T')[0])
      }
      m++; if (m > 11) { m = 0; y++ }
    }
  }
  return dates
}

interface Props {
  open:               boolean
  onClose:            () => void
  onSuccess:          (serviceId?: string) => void
  initialDate?:       string
  initialClientId?:   string
  initialBasePrice?:  string
  initialNotes?:      string
  initialAddress?:    string
  initialClientName?: string
  initialClientPhone?: string
  initialService?:    any  // pre-fill all fields from an existing service
}

export default function ServiceModal({ open, onClose, onSuccess, initialDate, initialClientId, initialBasePrice, initialNotes, initialAddress, initialClientName, initialClientPhone, initialService }: Props) {
  const [clients, setClients] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pricedFromMgmt, setPricedFromMgmt] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)

  // Recurrence
  const [recurDays,      setRecurDays]      = useState<number[]>([])
  const [recurMonthDays, setRecurMonthDays] = useState<number[]>([])
  const [recurMonthlyMode, setRecurMonthlyMode] = useState<'dayOfMonth' | 'nthWeekday'>('dayOfMonth')
  const [recurNthOrdinal,  setRecurNthOrdinal]  = useState(1)
  const [recurNthWeekday,  setRecurNthWeekday]  = useState(0)
  const [recurEndType,   setRecurEndType]   = useState<'count' | 'date'>('count')
  const [recurCount,     setRecurCount]     = useState('8')
  const [recurEndDate,   setRecurEndDate]   = useState('')

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([])
  const [addressLoading, setAddressLoading] = useState(false)
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressBoxRef = useRef<HTMLDivElement>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const [addressDropdownRect, setAddressDropdownRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addressBoxRef.current && !addressBoxRef.current.contains(e.target as Node))
        setAddressSuggestions([])
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) { setAddressSuggestions([]); setAddressDropdownRect(null) }
  }, [open])

  function searchAddress(query: string) {
    if (addressDebounce.current) clearTimeout(addressDebounce.current)
    if (query.length < 4) { setAddressSuggestions([]); return }
    addressDebounce.current = setTimeout(async () => {
      setAddressLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=us&limit=6`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setAddressSuggestions(data.map((item: any) => item.display_name))
      } catch { setAddressSuggestions([]) }
      finally { setAddressLoading(false) }
    }, 350)
  }

  const [form, setForm] = useState({
    clientId: '',
    type: 'Standard Clean',
    serviceDate: '',
    serviceTime: '',
    address: '',
    unit: '',
    numericKey: '',
    roomSize: '',
    frequency: 'one_time',
    basePrice: '',
    additionalFee: '',
    paymentMethod: 'zelle',
    status: 'pending',
    internalNotes: '',
    staffNotes: '',
    sendEmail: false,
    staffIds: [] as string[],
  })

  useEffect(() => {
    if (!open) return
    if (initialService) {
      setForm(f => ({
        ...f,
        clientId:      initialService.clientId      || '',
        type:          initialService.type          || 'Standard Clean',
        serviceDate:   initialService.serviceDate?.split('T')[0] || '',
        serviceTime:   initialService.serviceTime   || '',
        address:       initialService.address       || '',
        unit:          initialService.unit          || '',
        numericKey:    initialService.numericKey    || '',
        roomSize:      initialService.roomSize      || '',
        frequency:     initialService.frequency     || 'one_time',
        basePrice:     String(initialService.basePrice     || ''),
        additionalFee: String(initialService.additionalFee || ''),
        paymentMethod: initialService.paymentMethod || 'zelle',
        staffIds:      initialService.staff?.map((st: any) => st.userId) || [],
      }))
      return
    }
    setForm(f => ({
      ...f,
      ...(initialDate      ? { serviceDate:   initialDate }      : {}),
      ...(initialClientId  ? { clientId:      initialClientId }  : {}),
      ...(initialBasePrice ? { basePrice:     initialBasePrice } : {}),
      ...(initialNotes     ? { internalNotes: initialNotes }     : {}),
      ...(initialAddress   ? { address:       initialAddress }   : {}),
    }))
  }, [open, initialService, initialDate, initialClientId, initialBasePrice, initialNotes, initialAddress])

  function loadClients(autoSelectId?: string) {
    fetch('/api/clients').then(r => r.json()).catch(() => []).then((c: any[]) => {
      setClients(c)
      if (autoSelectId) set('clientId', autoSelectId)
    })
  }

  async function handleQuickCreateClient() {
    if (!initialClientName) return
    setCreatingClient(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    initialClientName,
          phone:   initialClientPhone || '',
          email:   '',
          address: initialAddress || '',
          type:    'residential',
        }),
      })
      if (res.ok) {
        const newClient = await res.json()
        setClients(prev => [...prev, newClient])
        set('clientId', newClient.id)
      }
    } catch {}
    finally { setCreatingClient(false) }
  }

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
        const ar = ai === -1 ? 999 : ai
        const br = bi === -1 ? 999 : bi
        return ar - br
      }))
    })
  }, [open])

  // Auto-populate address from client
  useEffect(() => {
    const client = clients.find(c => c.id === form.clientId)
    if (client?.address) setForm(f => ({ ...f, address: client.address }))
  }, [form.clientId, clients])

  // Auto-price only for NEW services (not edits) — only Base Price, never Additional Fee
  useEffect(() => {
    if (initialService) return  // editing: never overwrite existing prices
    const client = clients.find(c => c.id === form.clientId)
    if (!form.clientId || !client) { setPricedFromMgmt(false); return }

    if (client.management?.name === PRIVATE_CUSTOMER_NAME) {
      const result = calcPrivatePrices(client, form.frequency)
      if (result) {
        setForm(f => ({ ...f, basePrice: result.base.toString() }))
        setPricedFromMgmt(true)
      } else {
        setPricedFromMgmt(false)
      }
      return
    }

    // Standard management: room-size based
    if (!form.roomSize || !AUTO_PRICE_TYPES.has(form.type)) { setPricedFromMgmt(false); return }
    const result = calcPrices(client, form.type, form.roomSize)
    if (result) {
      setForm(f => ({ ...f, basePrice: result.base.toString() }))
      setPricedFromMgmt(true)
    } else {
      setPricedFromMgmt(false)
    }
  }, [form.clientId, form.type, form.roomSize, form.frequency, clients, initialService])

  const total = (parseFloat(form.basePrice) || 0) + (parseFloat(form.additionalFee) || 0)

  const isRecurring = form.frequency !== 'one_time'
  const generatedDates = useMemo(() => {
    if (!isRecurring || !form.serviceDate) return form.serviceDate ? [form.serviceDate] : []
    if ((form.frequency === 'weekly' || form.frequency === 'biweekly') && recurDays.length === 0) return []
    if (form.frequency === 'monthly' && recurMonthlyMode === 'dayOfMonth' && recurMonthDays.length === 0) return []
    if (recurEndType === 'date' && !recurEndDate) return []
    return generateDates(
      form.serviceDate, form.frequency, recurDays, recurMonthDays, recurEndType, recurEndDate, parseInt(recurCount) || 8,
      recurMonthlyMode, recurNthOrdinal, recurNthWeekday,
    )
  }, [isRecurring, form.serviceDate, form.frequency, recurDays, recurMonthDays, recurEndType, recurEndDate, recurCount, recurMonthlyMode, recurNthOrdinal, recurNthWeekday])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleStaff(id: string) {
    setForm(f => ({
      ...f,
      staffIds: f.staffIds.includes(id)
        ? f.staffIds.filter(s => s !== id)
        : [...f.staffIds, id]
    }))
  }

  function resetForm() {
    setForm({
      clientId: '', type: 'Standard Clean', serviceDate: '',
      serviceTime: '', address: '', unit: '', numericKey: '', roomSize: '',
      frequency: 'one_time', basePrice: '', additionalFee: '',
      paymentMethod: 'zelle', status: 'pending',
      internalNotes: '', staffNotes: '', sendEmail: false, staffIds: [],
    })
    setPricedFromMgmt(false)
    setRecurDays([])
    setRecurMonthDays([])
    setRecurMonthlyMode('dayOfMonth')
    setRecurNthOrdinal(1)
    setRecurNthWeekday(0)
    setRecurEndType('count')
    setRecurCount('8')
    setRecurEndDate('')
  }

  async function handleSubmit() {
    if (!form.clientId || !form.serviceDate || !form.serviceTime || !form.basePrice) {
      setError('Please fill in all required fields.')
      return
    }
    if (isRecurring && generatedDates.length === 0) {
      setError('Configure recurrence days and end condition before saving.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const dates = isRecurring ? generatedDates : [form.serviceDate]
      let firstId: string | undefined
      for (const date of dates) {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            serviceDate: date,
            basePrice: parseFloat(form.basePrice),
            additionalFee: parseFloat(form.additionalFee) || 0,
            total,
            notes: form.internalNotes,
            parentServiceId: firstId ?? null,
          })
        })
        if (!res.ok) throw new Error()
        if (!firstId) { const d = await res.json(); firstId = d.id }
      }
      onSuccess(firstId)
      onClose()
      resetForm()
    } catch {
      setError('Failed to create service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const selectedClient = clients.find(c => c.id === form.clientId)
  const hasMgmt = !!selectedClient?.management
  const mgmtName = selectedClient?.management?.name
  const isPrivateCustomer = mgmtName === PRIVATE_CUSTOMER_NAME
  const pcRef = selectedClient?.priceRef

  // Fee label based on type
  const feeLabel =
    form.type === 'Deep Clean' ? 'Deep Clean Fee' :
    form.type === 'Heavy Deep Clean' ? 'HDC Fee' :
    'Additional Fee'

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-[var(--text)]">New Service</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">Schedule a new cleaning service</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface3)] transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Client + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                Client <span className="text-[#f87171]">*</span>
              </label>
              <select
                value={form.clientId}
                onChange={e => {
                  if (e.target.value === '__add_client__') { setClientModalOpen(true); return }
                  set('clientId', e.target.value)
                }}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">Select client...</option>
                {clients.filter(c => c.status !== 'inactive').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__add_client__">+ New Client…</option>
              </select>
              {hasMgmt && (
                <div className="flex items-center gap-1 mt-1">
                  <Layers size={9} className="text-[var(--accent)]" />
                  <span className="text-[10px] text-[var(--accent)]">{mgmtName}</span>
                </div>
              )}
              {/* Estimate client reference banner */}
              {initialClientName && !form.clientId && (
                <div className="mt-2 p-2.5 bg-[rgba(167,139,250,0.08)] border border-[rgba(167,139,250,0.25)] rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-wider mb-0.5">From estimate</div>
                    <div className="text-xs font-semibold text-[var(--text)]">{initialClientName}</div>
                    {initialClientPhone && <div className="text-[10px] text-[var(--muted)]">{initialClientPhone}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCreateClient}
                    disabled={creatingClient}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-[#a78bfa] hover:bg-[#9061f9] disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
                  >
                    {creatingClient ? 'Adding…' : '+ Register Client'}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                Service Type <span className="text-[#f87171]">*</span>
              </label>
              <SelectWithAdd
                value={form.type}
                onChange={v => set('type', v)}
                options={SERVICE_TYPES}
                storageKey="serviceType"
                addLabel="service type"
                capitalize={false}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                Date <span className="text-[#f87171]">*</span>
              </label>
              <input
                type="date"
                value={form.serviceDate}
                onChange={e => set('serviceDate', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                Time <span className="text-[#f87171]">*</span>
              </label>
              <select
                value={form.serviceTime}
                onChange={e => set('serviceTime', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">Select time…</option>
                {TIME_SLOTS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div ref={addressBoxRef} className="relative">
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
              Address {addressLoading && <span className="text-[var(--muted)] normal-case font-normal">searching…</span>}
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={form.address}
              onChange={e => {
                set('address', e.target.value)
                searchAddress(e.target.value)
                setAddressDropdownRect(addressInputRef.current?.getBoundingClientRect() ?? null)
              }}
              placeholder="Start typing an address…"
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              autoComplete="off"
            />
          </div>
          {addressSuggestions.length > 0 && addressDropdownRect && (
            <div
              style={{
                position: 'fixed',
                left: addressDropdownRect.left,
                top: addressDropdownRect.bottom + 4,
                width: addressDropdownRect.width,
                zIndex: 9999,
              }}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {addressSuggestions.map((addr, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    set('address', addr)
                    setAddressSuggestions([])
                    setAddressDropdownRect(null)
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] border-b border-[var(--border)] last:border-0 transition-colors leading-tight"
                >
                  {addr}
                </button>
              ))}
            </div>
          )}

          {/* Unit + Clave Numerico + Room Size */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                placeholder="Apt 2B, Unit 101..."
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Clave Numerico</label>
              <input
                type="text"
                value={form.numericKey}
                onChange={e => set('numericKey', e.target.value)}
                placeholder="Ej: 1234"
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Room Size</label>
              <SelectWithAdd
                value={form.roomSize}
                onChange={v => set('roomSize', v)}
                options={ROOM_SIZES}
                storageKey="roomSize"
                placeholder="Select size..."
                addLabel="room size"
                capitalize={false}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Pricing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                Pricing <span className="text-[#f87171]">*</span>
              </label>
              {pricedFromMgmt && mgmtName && (
                <div className="flex items-center gap-1">
                  <DollarSign size={9} className="text-[var(--accent)]" />
                  <span className="text-[10px] text-[var(--accent)]">Auto-filled from {mgmtName}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Base Price */}
              <div>
                <label className="text-[10px] text-[var(--muted)] block mb-1">
                  Base Price
                  {pricedFromMgmt && form.roomSize && form.type !== 'Office Clean' && form.roomSize !== 'Office/Amenities' && (
                    <span className="ml-1 text-[var(--accent)]">({form.roomSize} STD)</span>
                  )}
                </label>
                <div className={`relative rounded-lg border transition-all ${
                  pricedFromMgmt ? 'border-[var(--accent)]' : 'border-[var(--border)]'
                }`}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={e => { set('basePrice', e.target.value); setPricedFromMgmt(false) }}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-2 bg-[var(--surface2)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Additional Fee — always manual, never auto-filled */}
              <div>
                <label className="text-[10px] text-[var(--muted)] block mb-1">{feeLabel}</label>
                <div className="relative rounded-lg border border-[var(--border)]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs">$</span>
                  <input
                    type="number"
                    value={form.additionalFee}
                    onChange={e => set('additionalFee', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-2 bg-[var(--surface2)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Total */}
              <div>
                <label className="text-[10px] text-[var(--muted)] block mb-1">Total</label>
                <div className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs font-bold text-[#38d9a9]">
                  ${total.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Price breakdown hint for DC/HDC (standard management) */}
            {pricedFromMgmt && !isPrivateCustomer && (form.type === 'Deep Clean' || form.type === 'Heavy Deep Clean') && form.basePrice && form.additionalFee && (
              <div className="mt-2 text-[10px] text-[var(--muted)] bg-[rgba(74,63,176,0.06)] border border-[rgba(74,63,176,0.15)] rounded-lg px-3 py-2">
                Base (STD {form.roomSize}) <span className="text-[var(--text)]">${form.basePrice}</span>
                {' '}+ {form.type === 'Deep Clean' ? 'Deep Clean' : 'HDC'} Fee <span className="text-[var(--text)]">${form.additionalFee}</span>
                {' '}= <span className="text-[#38d9a9] font-bold">${total.toFixed(2)}</span>
              </div>
            )}

            {/* Deep Clean range reference for Private Customer */}
            {isPrivateCustomer && (form.type === 'Deep Clean' || form.type === 'Heavy Deep Clean') && (pcRef?.deepCleanMin || pcRef?.deepCleanMax) && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--muted)] bg-[rgba(74,63,176,0.06)] border border-[rgba(74,63,176,0.15)] rounded-lg px-3 py-2">
                <Info size={10} className="text-[var(--accent)] flex-shrink-0" />
                Deep Clean reference:{' '}
                <span className="text-[var(--text)] font-semibold">
                  {pcRef?.deepCleanMin && pcRef?.deepCleanMax
                    ? `$${pcRef.deepCleanMin} – $${pcRef.deepCleanMax}`
                    : pcRef?.deepCleanMin
                    ? `from $${pcRef.deepCleanMin}`
                    : `up to $${pcRef.deepCleanMax}`}
                </span>
                <span className="ml-1">· Enter price manually</span>
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Frequency</label>
            <select
              value={form.frequency}
              onChange={e => { set('frequency', e.target.value); setRecurDays([]); setRecurMonthDays([]) }}
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              {FREQUENCIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Recurrence config */}
          {isRecurring && (
            <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-4 space-y-4">
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">🔁 Recurrence</div>

              {/* Weekly / Biweekly — day-of-week selector */}
              {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
                <div>
                  <div className="text-[10px] text-[var(--muted)] mb-2">Repeat on</div>
                  <div className="flex gap-1.5">
                    {WEEK_DAYS.map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRecurDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                          recurDays.includes(i)
                            ? 'bg-[rgba(74,63,176,0.15)] border-[var(--accent)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly — day-of-month grid, or Nth weekday (e.g. "2nd Sunday") */}
              {form.frequency === 'monthly' && (
                <div>
                  <div className="flex gap-2 mb-2">
                    {[{ value: 'dayOfMonth', label: 'Day of month' }, { value: 'nthWeekday', label: 'Day of week' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRecurMonthlyMode(opt.value as 'dayOfMonth' | 'nthWeekday')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          recurMonthlyMode === opt.value
                            ? 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--muted)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {recurMonthlyMode === 'dayOfMonth' ? (
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setRecurMonthDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                          className={`w-8 h-8 rounded-lg text-[10px] font-bold border transition-all ${
                            recurMonthDays.includes(day)
                              ? 'bg-[rgba(74,63,176,0.15)] border-[var(--accent)] text-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={recurNthOrdinal}
                        onChange={e => setRecurNthOrdinal(Number(e.target.value))}
                        className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {['First', 'Second', 'Third', 'Fourth', 'Fifth'].map((label, i) => (
                          <option key={i} value={i + 1}>{label}</option>
                        ))}
                        <option value={-1}>Last</option>
                      </select>
                      <select
                        value={recurNthWeekday}
                        onChange={e => setRecurNthWeekday(Number(e.target.value))}
                        className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, i) => (
                          <option key={i} value={i}>{label}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-[var(--muted)]">of the month</span>
                    </div>
                  )}
                </div>
              )}

              {/* End condition */}
              <div>
                <div className="text-[10px] text-[var(--muted)] mb-2">Ends</div>
                <div className="flex gap-2 mb-2">
                  {[{ value: 'count', label: 'After N services' }, { value: 'date', label: 'By date' }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRecurEndType(opt.value as 'count' | 'date')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        recurEndType === opt.value
                          ? 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {recurEndType === 'count' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={recurCount}
                      onChange={e => setRecurCount(e.target.value)}
                      min="1" max="104"
                      className="w-20 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <span className="text-[10px] text-[var(--muted)]">occurrences</span>
                  </div>
                ) : (
                  <input
                    type="date"
                    value={recurEndDate}
                    onChange={e => setRecurEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                )}
              </div>

              {/* Preview */}
              {generatedDates.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] bg-[rgba(74,63,176,0.06)] border border-[rgba(74,63,176,0.15)] rounded-lg px-3 py-2">
                  <span>📅</span>
                  <span>Will create <strong>{generatedDates.length} services</strong></span>
                  <span className="text-[var(--muted)]">· {generatedDates[0]} → {generatedDates[generatedDates.length - 1]}</span>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Staff Assignment */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-2">Assign Staff</label>
            <div className="flex flex-wrap gap-2">
              {staff.map(member => {
                const selected = form.staffIds.includes(member.id)
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

          {/* Internal Notes */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Internal Notes</label>
            <textarea
              value={form.internalNotes}
              onChange={e => set('internalNotes', e.target.value)}
              placeholder="Private notes..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
          </div>

          {/* Staff Notes */}
          <div>
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Notes for Staff</label>
            <textarea
              value={form.staffNotes}
              onChange={e => set('staffNotes', e.target.value)}
              placeholder="Instructions for staff..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
          </div>

          {/* Send Email Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center gap-3">
              <Mail size={14} className="text-[var(--accent)]" />
              <div>
                <div className="text-xs font-semibold text-[var(--text)]">Send Confirmation Email to Client</div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5">Service details, date, time and staff will be included</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => set('sendEmail', !form.sendEmail)}
              className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                form.sendEmail ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${
                form.sendEmail ? 'left-5' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-[var(--muted)]">
            {isRecurring && generatedDates.length > 0
              ? `${generatedDates.length} services · ${form.staffIds.length > 0 ? `${form.staffIds.length} staff` : ''}`
              : form.staffIds.length > 0 ? `${form.staffIds.length} staff assigned` : ''}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--surface3)] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              <Plus size={13} />
              {loading ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ClientModal
      open={clientModalOpen}
      onClose={() => setClientModalOpen(false)}
      onSuccess={(newId) => { setClientModalOpen(false); loadClients(newId) }}
    />
    </>
  )
}
