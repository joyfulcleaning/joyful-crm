'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Clock, CheckCircle, AlertCircle, CalendarDays, Loader2 } from 'lucide-react'
import ErrorBanner from '@/components/ErrorBanner'

// ── Module-level geocode cache: persists across re-renders for the full session
const _geocodeCache = new Map<string, [number, number] | null>()

function fmt12h(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
let _lastGeocodeMs = 0

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address?.trim()) return null
  const key = address.trim().toLowerCase()
  if (_geocodeCache.has(key)) return _geocodeCache.get(key)!
  // Nominatim policy: max 1 req/sec
  const wait = Math.max(0, 1100 - (Date.now() - _lastGeocodeMs))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _lastGeocodeMs = Date.now()
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const d = await r.json()
    if (d[0]) {
      const coords: [number, number] = [parseFloat(d[0].lat), parseFloat(d[0].lon)]
      _geocodeCache.set(key, coords)
      return coords
    }
  } catch {}
  _geocodeCache.set(key, null)
  return null
}

const MapComponent = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#111827]">
      <div className="text-[#6b7280] text-sm">Loading map...</div>
    </div>
  ),
})

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  completed: '#38d9a9',
  cancelled: '#f87171',
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  in_progress: AlertCircle,
  completed: CheckCircle,
  cancelled: AlertCircle,
}

export default function MapPage() {
  const [services, setServices] = useState<any[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const [geoServices, setGeoServices] = useState<any[]>([])
  const [geocoding, setGeocoding] = useState(false)

  function loadServices() {
    fetch('/api/services')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar los servicios.')
        return data
      })
      .then(data => { setServices(data); setLoadError(null) })
      .catch((err) => { setLoadError(err.message || 'No se pudieron cargar los servicios.'); setServices([]) })
  }

  useEffect(() => { loadServices() }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    if (showDatePicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDatePicker])

  const today = new Date().toLocaleDateString('en-CA')
  const isToday = selectedDate === today
  const todayServices = services.filter(s => s.serviceDate?.startsWith(selectedDate))

  const filtered = filter === 'all'
    ? todayServices
    : todayServices.filter(s => s.status === filter)

  useEffect(() => {
    const todaySvcs = services.filter(s => s.serviceDate?.startsWith(selectedDate))
    const filteredSvcs = filter === 'all' ? todaySvcs : todaySvcs.filter(s => s.status === filter)
    if (filteredSvcs.length === 0) { setGeoServices([]); setGeocoding(false); return }
    setGeocoding(true)
    let cancelled = false
    ;(async () => {
      const result: any[] = []
      for (const s of filteredSvcs) {
        if (cancelled) return
        const coords = await geocodeAddress(s.address)
        result.push({ ...s, lat: coords?.[0] ?? null, lng: coords?.[1] ?? null })
        if (!cancelled) setGeoServices([...result])
      }
      if (!cancelled) setGeocoding(false)
    })()
    return () => { cancelled = true }
  }, [services, filter, selectedDate])

  const counts = {
    all: todayServices.length,
    pending: todayServices.filter(s => s.status === 'pending').length,
    in_progress: todayServices.filter(s => s.status === 'in_progress').length,
    completed: todayServices.filter(s => s.status === 'completed').length,
  }

  const totalRevenue = todayServices.reduce((sum, s) => sum + (Number(s.total) || 0), 0)

  return (
    <div className="flex flex-col h-full gap-0 -m-6">
      {loadError && <div className="px-6 pt-4"><ErrorBanner message={loadError} onRetry={loadServices} /></div>}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2f3d] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">Map View</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {isToday ? 'Today' : (([y,m,d]) => `${m}-${d}-${y}`)(selectedDate.split('-'))} · {todayServices.length} services
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date picker */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showDatePicker
                  ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]'
                  : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] hover:border-[#343c52]'
              }`}
            >
              <CalendarDays size={12} />
              {isToday ? 'Today' : selectedDate}
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-1 z-[2000] bg-[#161922] border border-[#2a2f3d] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] p-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setShowDatePicker(false); setSelected(null) }}
                  className="px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]"
                />
                <button
                  onClick={() => { setSelectedDate(today); setShowDatePicker(false); setSelected(null) }}
                  className="mt-2 w-full text-[10px] font-semibold text-[#4f8ef7] hover:text-[#e8eaf0] transition-colors"
                >
                  Jump to today
                </button>
              </div>
            )}
          </div>
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'pending', label: `⏳ Pending (${counts.pending})` },
            { key: 'in_progress', label: `🔄 In Progress (${counts.in_progress})` },
            { key: 'completed', label: `✅ Completed (${counts.completed})` },
          ].map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === chip.key
                  ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]'
                  : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] hover:border-[#343c52]'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#2a2f3d] text-[#6b7280] hover:border-[#4f8ef7] hover:text-[#4f8ef7] transition-all">
            📍 Optimize Route
          </button>
        </div>
      </div>

      {/* Map + Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent services={geoServices} selected={selected} onSelect={setSelected} />
          {geocoding && (
            <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 bg-[#161922] border border-[#2a2f3d] rounded-lg px-3 py-2 shadow-lg">
              <Loader2 size={12} className="animate-spin text-[#4f8ef7]" />
              <span className="text-[11px] text-[#6b7280]">Locating addresses…</span>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-72 bg-[#161922] border-l border-[#2a2f3d] flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-[#2a2f3d]">
            <div className="text-xs font-bold text-[#e8eaf0]">{isToday ? "Today's Services" : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div className="text-xs text-[#6b7280] mt-0.5">{todayServices.length} services</div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">No services for today</div>
            ) : (
              filtered.map((s: any) => {
                const color = STATUS_COLORS[s.status] || '#6b7280'
                const isSelected = selected?.id === s.id
                const geo = geoServices.find(g => g.id === s.id)
                const noLocation = geo && geo.lat === null
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelected(isSelected ? null : s)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                        : noLocation
                        ? 'border-[#f87171]/30 bg-[#1e2330] hover:border-[#f87171]/60'
                        : 'border-[#2a2f3d] bg-[#1e2330] hover:border-[#343c52]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#e8eaf0] truncate">{s.client?.name}</div>
                        <div className="text-[10px] text-[#6b7280] mt-0.5 truncate">{s.address}</div>
                        <div className="text-[10px] text-[#6b7280] mt-0.5">{fmt12h(s.serviceTime)} · {s.type}</div>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {s.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-[#6b7280]">
                        <MapPin size={10} className={noLocation ? 'text-[#f87171]' : ''} />
                        {noLocation
                          ? <span className="text-[#f87171]">No location found</span>
                          : <span className="truncate">{s.address?.split(',')[0]}</span>
                        }
                      </div>
                      <div className="text-[10px] font-bold text-[#38d9a9]">${s.total}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-[#2a2f3d] p-3 grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-sm font-bold text-[#38d9a9]">{counts.completed}</div>
              <div className="text-[10px] text-[#6b7280]">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#4f8ef7]">{counts.in_progress}</div>
              <div className="text-[10px] text-[#6b7280]">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#f59e0b]">{counts.pending}</div>
              <div className="text-[10px] text-[#6b7280]">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#e8eaf0]">${totalRevenue.toLocaleString()}</div>
              <div className="text-[10px] text-[#6b7280]">Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}