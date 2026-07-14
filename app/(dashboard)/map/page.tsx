'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { MapPin, Clock, CheckCircle, AlertCircle, CalendarDays, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import ErrorBanner from '@/components/ErrorBanner'
import { useI18n } from '@/lib/i18n'
import { loadMapKit } from '@/lib/mapkit-client'
import { haversineMeters } from '@/lib/geo'

// ── Module-level geocode cache: persists across re-renders for the full session
const _geocodeCache = new Map<string, [number, number] | null>()

// Same radius the server uses to decide "still at the same spot" — a pin
// counts as "team is here" if the business phone is within this distance.
const AT_LOCATION_RADIUS_METERS = 120

function fmt12h(t?: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function fmtDwell(arrivedAt: string, t: any): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(arrivedAt).getTime()) / 60000))
  if (mins < 60) return t.mapPage.dwellMinutes(mins)
  return t.mapPage.dwellHoursMinutes(Math.floor(mins / 60), mins % 60)
}

// Business is based in Fayetteville, NC and only services that immediate
// area — bias the geocoder there so a vague/partial address (e.g. missing
// city or state) resolves to the closest local match instead of a
// same-named place on another continent.
const SERVICE_AREA_REGION = { center: [35.0527, -78.8784] as [number, number], span: 3 }

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address?.trim()) return null
  const key = address.trim().toLowerCase()
  if (_geocodeCache.has(key)) return _geocodeCache.get(key)!
  try {
    const mapkit = await loadMapKit()
    const geocoder = new mapkit.Geocoder({ language: 'en-US' })
    const region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(...SERVICE_AREA_REGION.center),
      new mapkit.CoordinateSpan(SERVICE_AREA_REGION.span, SERVICE_AREA_REGION.span)
    )
    const coords = await new Promise<[number, number] | null>(resolve => {
      geocoder.lookup(address, (error: any, data: any) => {
        if (error || !data?.results?.length) { resolve(null); return }
        const c = data.results[0].coordinate
        resolve([c.latitude, c.longitude])
      }, { region })
    })
    _geocodeCache.set(key, coords)
    return coords
  } catch {
    _geocodeCache.set(key, null)
    return null
  }
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function MapLoadingFallback() {
  const { t } = useI18n()
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#111827]">
      <div className="text-[#6b7280] text-sm">{t.mapPage.loadingMap}</div>
    </div>
  )
}

const MapComponent = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
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
  const { t } = useI18n()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'admin'
  const [services, setServices] = useState<any[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const [geoServices, setGeoServices] = useState<any[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [businessPhoneLocation, setBusinessPhoneLocation] = useState<{ lat: number; lng: number; updatedAt: string | null; arrivedAt: string | null } | null>(null)
  const [autoResume, setAutoResume] = useState(true)
  const [autoResumeLoaded, setAutoResumeLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    function loadBusinessPhoneLocation() {
      fetch('/api/business-phone-location')
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (!cancelled) setBusinessPhoneLocation(data) })
        .catch(() => {})
    }
    loadBusinessPhoneLocation()
    const interval = setInterval(loadBusinessPhoneLocation, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Admin-only preference the mobile app reads on open to decide whether to
  // silently restart location sharing if it finds itself stopped.
  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : ({} as Record<string, string>))
      .then((data: Record<string, string>) => { setAutoResume(data['businessPhone.autoResume'] !== 'false'); setAutoResumeLoaded(true) })
      .catch(() => setAutoResumeLoaded(true))
  }, [isAdmin])

  function toggleAutoResume() {
    const next = !autoResume
    setAutoResume(next)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'businessPhone.autoResume': String(next) }),
    }).catch(() => setAutoResume(!next))
  }

  function loadServices() {
    fetch('/api/services')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || t.mapPage.loadServicesError)
        return data
      })
      .then(data => { setServices(data); setLoadError(null) })
      .catch((err) => { setLoadError(err.message || t.mapPage.loadServicesError); setServices([]) })
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
          <h1 className="text-lg font-bold text-[#e8eaf0]">{t.mapPage.title}</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">
            {isToday ? t.mapPage.today : (([y,m,d]) => `${m}-${d}-${y}`)(selectedDate.split('-'))} · {t.mapPage.serviceCount(todayServices.length)}
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
              {isToday ? t.mapPage.today : selectedDate}
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
                  {t.mapPage.jumpToToday}
                </button>
              </div>
            )}
          </div>
          {[
            { key: 'all', label: t.mapPage.filterAll(counts.all) },
            { key: 'pending', label: t.mapPage.filterPending(counts.pending) },
            { key: 'in_progress', label: t.mapPage.filterInProgress(counts.in_progress) },
            { key: 'completed', label: t.mapPage.filterCompleted(counts.completed) },
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
        </div>
      </div>

      {/* Map + Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            services={geoServices}
            selected={selected}
            onSelect={setSelected}
            businessPhoneLocation={businessPhoneLocation ? {
              ...businessPhoneLocation,
              dwellText: businessPhoneLocation.arrivedAt ? fmtDwell(businessPhoneLocation.arrivedAt, t) : null,
            } : null}
          />
          {geocoding && (
            <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 bg-[#161922] border border-[#2a2f3d] rounded-lg px-3 py-2 shadow-lg">
              <Loader2 size={12} className="animate-spin text-[#4f8ef7]" />
              <span className="text-[11px] text-[#6b7280]">{t.mapPage.locatingAddresses}</span>
            </div>
          )}
          <div className="absolute bottom-4 right-4 z-[1000] flex items-center gap-2 bg-[#161922] border border-[#2a2f3d] rounded-lg px-3 py-2 shadow-lg">
            <span className={businessPhoneLocation ? 'text-[#a78bfa]' : 'text-[#6b7280]'}>📱</span>
            <span className="text-[11px] text-[#6b7280]">
              {businessPhoneLocation
                ? t.mapPage.businessPhoneUpdated(new Date(businessPhoneLocation.updatedAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
                : t.mapPage.businessPhoneOffline}
            </span>
            {isAdmin && autoResumeLoaded && (
              <>
                <span className="w-px h-3 bg-[#2a2f3d]" />
                <button
                  onClick={toggleAutoResume}
                  title={t.mapPage.autoResumeHint}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    autoResume
                      ? 'border-[#a78bfa] text-[#a78bfa] bg-[rgba(167,139,250,0.1)]'
                      : 'border-[#2a2f3d] text-[#6b7280]'
                  }`}
                >
                  {t.mapPage.autoResumeLabel} {autoResume ? t.mapPage.autoResumeOn : t.mapPage.autoResumeOff}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-72 bg-[#161922] border-l border-[#2a2f3d] flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#e8eaf0] truncate">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString(t.locale, { weekday: 'long', month: 'short', day: 'numeric' })}
                {isToday && <span className="text-[#4f8ef7]"> · {t.mapPage.today}</span>}
              </div>
              <div className="text-xs text-[#6b7280] mt-0.5">{t.mapPage.serviceCount(todayServices.length)}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => { setSelectedDate(shiftDate(selectedDate, -1)); setSelected(null) }}
                title={t.mapPage.previousDay}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1e2330] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => { setSelectedDate(shiftDate(selectedDate, 1)); setSelected(null) }}
                title={t.mapPage.nextDay}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1e2330] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">{t.mapPage.noServicesToday}</div>
            ) : (
              filtered.map((s: any) => {
                const color = STATUS_COLORS[s.status] || '#6b7280'
                const isSelected = selected?.id === s.id
                const geo = geoServices.find(g => g.id === s.id)
                const noLocation = geo && geo.lat === null
                const teamHere = !!(
                  businessPhoneLocation && geo?.lat != null && geo?.lng != null &&
                  haversineMeters(businessPhoneLocation.lat, businessPhoneLocation.lng, geo.lat, geo.lng) <= AT_LOCATION_RADIUS_METERS
                )
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
                        {t.status[s.status] || s.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-[#6b7280]">
                        <MapPin size={10} className={noLocation ? 'text-[#f87171]' : ''} />
                        {noLocation
                          ? <span className="text-[#f87171]">{t.mapPage.noLocationFound}</span>
                          : <span className="truncate">{s.address?.split(',')[0]}</span>
                        }
                      </div>
                      <div className="text-[10px] font-bold text-[#38d9a9]">${s.total}</div>
                    </div>
                    {teamHere && businessPhoneLocation?.arrivedAt && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-[#a78bfa]">
                        <span>📱</span>
                        <span>{t.mapPage.teamHereFor(fmtDwell(businessPhoneLocation.arrivedAt, t))}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-[#2a2f3d] p-3 grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-sm font-bold text-[#38d9a9]">{counts.completed}</div>
              <div className="text-[10px] text-[#6b7280]">{t.mapPage.summaryCompleted}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#4f8ef7]">{counts.in_progress}</div>
              <div className="text-[10px] text-[#6b7280]">{t.mapPage.summaryInProgress}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#f59e0b]">{counts.pending}</div>
              <div className="text-[10px] text-[#6b7280]">{t.mapPage.summaryPending}</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#e8eaf0]">${totalRevenue.toLocaleString()}</div>
              <div className="text-[10px] text-[#6b7280]">{t.mapPage.summaryTotal}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}