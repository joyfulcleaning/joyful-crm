'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, Navigation } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#4f8ef7',
  completed: '#38d9a9',
  cancelled: '#f87171',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const TYPE_ICONS: Record<string, string> = {
  'Standard Clean': '🧹',
  'Deep Clean': '🪣',
  'Office Clean': '🏢',
  'Move In/Out': '📦',
  'Touch Up': '✨',
  'Construction Clean': '🏗️',
  'Airbnb Clean': '🏠',
}

function createPin(color: string, selected: boolean) {
  const w = selected ? 40 : 32
  const h = selected ? 52 : 42
  return L.divIcon({
    html: `
      <div style="width:${w}px;height:${h}px;filter:drop-shadow(0 4px 8px ${color}90)">
        <svg width="${w}" height="${h}" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1C7.716 1 1 7.716 1 16c0 10.8 15 25 15 25S31 26.8 31 16C31 7.716 24.284 1 16 1z"
            fill="${color}" stroke="white" stroke-width="${selected ? 2.5 : 2}"/>
          <text x="16" y="17" text-anchor="middle" dominant-baseline="middle" font-size="13" font-family="sans-serif">🏠</text>
        </svg>
      </div>
    `,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  })
}

const DEFAULT_CENTER: [number, number] = [35.0527, -78.8784]

interface Popup {
  service: any
  x: number
  y: number
}

interface Props {
  services: any[]
  selected: any | null
  onSelect: (s: any | null) => void
}

export default function MapView({ services, selected, onSelect }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<Popup | null>(null)

  const closePopup = useCallback(() => {
    setPopup(null)
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '',
    }).addTo(map)

    const tiles = containerRef.current.querySelector('.leaflet-tile-pane') as HTMLElement
    if (tiles) {
      tiles.style.filter = 'brightness(0.75) saturate(0.6) hue-rotate(180deg) invert(1)'
    }

    map.on('click', () => setPopup(null))

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    setPopup(null)

    if (services.length === 0) return

    const bounds: [number, number][] = []

    services.forEach(s => {
      if (!s.lat || !s.lng) return

      const lat = s.lat
      const lng = s.lng
      bounds.push([lat, lng])

      const color = STATUS_COLORS[s.status] || '#6b7280'
      const isSelected = selected?.id === s.id
      const marker = L.marker([lat, lng], { icon: createPin(color, isSelected) })

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelect(s)
        if (containerRef.current) {
          const pt = map.latLngToContainerPoint([lat, lng])
          setPopup({ service: s, x: pt.x, y: pt.y })
        }
      })

      marker.addTo(map)
      markersRef.current.push(marker)
    })

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [services, selected])

  function openNavigation(s: any) {
    if (s.address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`,
        '_blank'
      )
    }
  }

  function getPopupStyle(x: number, y: number): React.CSSProperties {
    const cardW = 300
    const cardH = 330
    const containerW = containerRef.current?.clientWidth ?? 800

    let left = x - cardW / 2
    let top = y - cardH - 16

    if (left < 8) left = 8
    if (left + cardW > containerW - 8) left = containerW - cardW - 8
    if (top < 8) top = y + 28

    return { position: 'absolute', left, top, width: cardW, zIndex: 1000 }
  }

  return (
    <>
      <style>{`
        .leaflet-container { background: #111827; }
        .leaflet-control-zoom { border: 1px solid #2a2f3d !important; }
        .leaflet-control-zoom a { background: #161922 !important; color: #e8eaf0 !important; border-color: #2a2f3d !important; }
        .leaflet-control-zoom a:hover { background: #1e2330 !important; }
        .leaflet-attribution-flag { display: none !important; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />

        {popup && (
          <div style={getPopupStyle(popup.x, popup.y)}
            className="bg-[#161922] border border-[#2a2f3d] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.75)]"
          >
            {/* Close */}
            <button
              onClick={closePopup}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-[#252b3b] text-[#6b7280] hover:text-[#e8eaf0] transition-colors z-10"
            >
              <X size={12} />
            </button>

            <div className="p-4 pb-3">
              <div className="text-[11px] font-bold text-[#4f8ef7] mb-0.5">
                #{popup.service.serviceNumber}
              </div>
              <div className="text-[15px] font-bold text-[#e8eaf0] leading-tight pr-6">
                {popup.service.client?.name}
              </div>
              <div className="flex items-start gap-1 mt-1.5 text-[11px] text-[#9ca3af]">
                <span className="mt-px flex-shrink-0">📍</span>
                <span className="leading-tight">{popup.service.address || '—'}</span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-[#1e2330] rounded-xl p-2.5">
                  <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Hora</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[#e8eaf0]">
                    <span>⏰</span>
                    {popup.service.serviceTime
                      ? (() => {
                          const [h, m] = popup.service.serviceTime.split(':')
                          const hr = parseInt(h)
                          return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
                        })()
                      : '—'}
                  </div>
                </div>

                <div className="bg-[#1e2330] rounded-xl p-2.5">
                  <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Estado</div>
                  <div className="text-xs font-bold" style={{ color: STATUS_COLORS[popup.service.status] || '#6b7280' }}>
                    {STATUS_LABELS[popup.service.status] || popup.service.status}
                  </div>
                </div>

                <div className="bg-[#1e2330] rounded-xl p-2.5">
                  <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Empleado</div>
                  <div className="flex items-center gap-1 text-xs font-bold text-[#e8eaf0]">
                    <span>👤</span>
                    <span className="truncate">
                      {popup.service.staff?.length > 0
                        ? popup.service.staff.map((st: any) => st.user?.name?.split(' ')[0]).join(', ')
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#1e2330] rounded-xl p-2.5">
                  <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Unit</div>
                  <div className="text-xs font-bold text-[#e8eaf0]">{popup.service.unit || '—'}</div>
                </div>
              </div>

              <div className="mt-2">
                <div className="bg-[#1e2330] rounded-xl p-2.5">
                  <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Room Size</div>
                  <div className="text-xs font-bold text-[#e8eaf0]">{popup.service.roomSize || '—'}</div>
                </div>
              </div>

              {/* Type */}
              <div className="bg-[#1e2330] rounded-xl p-2.5 mt-2">
                <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Tipo</div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#e8eaf0]">
                  <span>{TYPE_ICONS[popup.service.type] || '🧹'}</span>
                  {popup.service.type}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button
                onClick={() => { onSelect(popup.service); closePopup() }}
                className="py-2.5 rounded-xl text-xs font-bold bg-[#1e2330] border border-[#2a2f3d] text-[#e8eaf0] hover:border-[#4f8ef7] hover:text-[#4f8ef7] transition-all"
              >
                Ver Detalle
              </button>
              <button
                onClick={() => openNavigation(popup.service)}
                className="py-2.5 rounded-xl text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Navigation size={11} />
                Navegar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
