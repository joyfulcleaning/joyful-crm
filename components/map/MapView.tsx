'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Navigation } from 'lucide-react'
import { loadMapKit } from '@/lib/mapkit-client'

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
  businessPhoneLocation?: { lat: number; lng: number; updatedAt: string | null } | null
}


export default function MapView({ services, selected, onSelect, businessPhoneLocation }: Props) {
  const mapRef = useRef<any>(null)
  const mapkitRef = useRef<any>(null)
  const annotationsRef = useRef<any[]>([])
  const businessPhoneAnnotationRef = useRef<any>(null)
  const selectedRef = useRef<any>(selected)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<Popup | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  selectedRef.current = selected

  const closePopup = useCallback(() => {
    setPopup(null)
  }, [])

  const showPopupForService = useCallback((s: any, coordinate: any) => {
    const map = mapRef.current
    if (!map || !wrapperRef.current) return
    const pagePoint = map.convertCoordinateToPointOnPage(coordinate)
    const rect = wrapperRef.current.getBoundingClientRect()
    setPopup({
      service: s,
      x: pagePoint.x - rect.left - window.scrollX,
      y: pagePoint.y - rect.top - window.scrollY,
    })
  }, [])

  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || mapRef.current) return
    let cancelled = false
    // Listeners go on the outer wrapper, not the map div — the popup card
    // is a sibling of the map div (both children of the wrapper), so
    // tracking only the map div would fire "mouseleave" the instant the
    // cursor moves onto the card itself, closing it before it could ever
    // be read or clicked.
    const wrapper = wrapperRef.current

    // DOM hit-testing (via composedPath, needed since MapKit renders inside
    // Shadow DOM) breaks once a pin grows on hover/selection: the enlarged
    // pin visually covers nearby clustered pins, so the browser keeps
    // reporting the big pin as the hover target even once the cursor is
    // over a neighbor. Instead we find the pin nearest to the cursor by
    // actual screen distance, which isn't affected by which pin is drawn
    // on top of which.
    const HOVER_RADIUS_PX = 26
    let hoveredAnnotation: any = null

    function nearestPin(mx: number, my: number) {
      const map = mapRef.current
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!map || !rect) return null
      let closest: any = null
      let closestDist = Infinity
      for (const ann of annotationsRef.current) {
        const pagePoint = map.convertCoordinateToPointOnPage(ann.coordinate)
        const px = pagePoint.x - rect.left - window.scrollX
        const py = pagePoint.y - rect.top - window.scrollY - 16 // pin anchor is at its bottom tip; bias toward the visible glyph
        const dist = Math.hypot(mx - px, my - py)
        if (dist < closestDist) { closestDist = dist; closest = ann }
      }
      return closestDist <= HOVER_RADIUS_PX ? closest : null
    }
    // Reverts the previously-hovered pin's "selected" (grown/animated) look
    // back to whatever it should be based on the real click-selection —
    // MapKit's own selected marker animation is reused for hover too.
    function resetHoverVisual() {
      if (hoveredAnnotation) {
        hoveredAnnotation.selected = selectedRef.current?.id === hoveredAnnotation.__service?.id
        hoveredAnnotation = null
      }
    }
    function handleMouseMove(e: MouseEvent) {
      // Moving onto the card itself (e.g. to click "View Detail") should
      // neither close it nor fight over which pin is "nearest".
      if (e.target instanceof Node && cardRef.current?.contains(e.target)) return

      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      const ann = nearestPin(e.clientX - rect.left, e.clientY - rect.top)
      if (ann === hoveredAnnotation) return
      resetHoverVisual()
      if (ann) {
        ann.selected = true
        hoveredAnnotation = ann
        showPopupForService(ann.__service, ann.coordinate)
      } else {
        setPopup(null)
      }
    }
    function handleMouseLeaveWrapper() {
      resetHoverVisual()
      setPopup(null)
    }
    wrapper.addEventListener('mousemove', handleMouseMove)
    wrapper.addEventListener('mouseleave', handleMouseLeaveWrapper)

    loadMapKit()
      .then(mapkit => {
        if (cancelled || !containerRef.current) return
        mapkitRef.current = mapkit

        const map = new mapkit.Map(containerRef.current, {
          center: new mapkit.Coordinate(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          colorScheme: mapkit.Map.ColorSchemes.Dark,
          showsMapTypeControl: true,
          showsZoomControl: true,
          showsScale: mapkit.FeatureVisibility.Hidden,
        })

        map.addEventListener('single-tap', () => setPopup(null))

        mapRef.current = map
      })
      .catch(() => { if (!cancelled) setLoadFailed(true) })

    return () => {
      cancelled = true
      wrapper.removeEventListener('mousemove', handleMouseMove)
      wrapper.removeEventListener('mouseleave', handleMouseLeaveWrapper)
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null }
    }
  }, [showPopupForService])

  useEffect(() => {
    const map = mapRef.current
    const mapkit = mapkitRef.current
    if (!map || !mapkit) return

    annotationsRef.current.forEach(a => map.removeAnnotation(a))
    annotationsRef.current = []
    setPopup(null)

    if (services.length === 0) return

    const newAnnotations: any[] = []

    services.forEach(s => {
      if (!s.lat || !s.lng) return

      const coordinate = new mapkit.Coordinate(s.lat, s.lng)
      const color = STATUS_COLORS[s.status] || '#6b7280'
      const isSelected = selected?.id === s.id

      const annotation = new mapkit.MarkerAnnotation(coordinate, {
        color,
        glyphText: '🏠',
        selected: isSelected,
        titleVisibility: mapkit.FeatureVisibility.Hidden,
        subtitleVisibility: mapkit.FeatureVisibility.Hidden,
      })

      // Stashed for the delegated hover handlers above and for the
      // 'select' handler below — annotations are plain objects, so this
      // is just a convenient way to get back to the service that owns one.
      annotation.__service = s

      annotation.addEventListener('select', () => {
        onSelect(s)
        showPopupForService(s, coordinate)
      })

      map.addAnnotation(annotation)
      newAnnotations.push(annotation)
    })

    annotationsRef.current = newAnnotations

    if (newAnnotations.length > 0) {
      map.showItems(newAnnotations, { animate: false, padding: new mapkit.Padding(60, 60, 60, 60) })
    }
  }, [services, selected, showPopupForService])

  // Live marker for the single shared business phone (not a service pin —
  // no hover card, just a native MapKit callout on click). Moves the same
  // annotation on updates instead of recreating it, so it doesn't flicker.
  useEffect(() => {
    const map = mapRef.current
    const mapkit = mapkitRef.current
    if (!map || !mapkit) return

    if (!businessPhoneLocation) {
      if (businessPhoneAnnotationRef.current) {
        map.removeAnnotation(businessPhoneAnnotationRef.current)
        businessPhoneAnnotationRef.current = null
      }
      return
    }

    const coordinate = new mapkit.Coordinate(businessPhoneLocation.lat, businessPhoneLocation.lng)
    const subtitle = businessPhoneLocation.updatedAt
      ? new Date(businessPhoneLocation.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : undefined

    if (businessPhoneAnnotationRef.current) {
      businessPhoneAnnotationRef.current.coordinate = coordinate
      businessPhoneAnnotationRef.current.subtitle = subtitle
    } else {
      const annotation = new mapkit.MarkerAnnotation(coordinate, {
        color: '#a78bfa',
        glyphText: '📱',
        title: 'Business Phone',
        subtitle,
      })
      map.addAnnotation(annotation)
      businessPhoneAnnotationRef.current = annotation
    }
  }, [businessPhoneLocation])

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
    const gap = 16
    // Pin coordinate is its bottom tip; the visible glyph sits above/around
    // that point and grows on hover/selection — clear that footprint so the
    // pin stays visible, but prefer sitting beside it rather than pushing
    // the card far away.
    const pinHalfWidth = 24
    const containerW = containerRef.current?.clientWidth ?? 800
    const containerH = containerRef.current?.clientHeight ?? 600

    const spaceRight = containerW - (x + pinHalfWidth)
    const spaceLeft = x - pinHalfWidth

    // When placing beside the pin, don't just center vertically on it —
    // check there's actually room both above and below first, otherwise
    // hug whichever side (above/below the pin's y) has more space so the
    // full card height fits instead of getting clamped/cut off.
    function verticallyFit(): number {
      const spaceAbove = y
      const spaceBelow = containerH - y
      if (spaceAbove >= cardH / 2 && spaceBelow >= cardH / 2) return y - cardH / 2
      return spaceAbove >= spaceBelow ? y - cardH : y
    }

    let left: number
    let top: number

    if (spaceRight >= cardW + gap) {
      left = x + pinHalfWidth + gap
      top = verticallyFit()
    } else if (spaceLeft >= cardW + gap) {
      left = x - pinHalfWidth - gap - cardW
      top = verticallyFit()
    } else {
      // Not enough room on either side — fall back to above/below, whichever fits.
      left = x - cardW / 2
      const spaceAbove = y - gap
      top = spaceAbove >= cardH ? y - cardH - gap : y + gap
    }

    if (left < 8) left = 8
    if (left + cardW > containerW - 8) left = containerW - cardW - 8
    if (top < 8) top = 8
    if (top + cardH > containerH - 8) top = containerH - cardH - 8

    return { position: 'absolute', left, top, width: cardW, zIndex: 1000 }
  }

  if (loadFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#111827] text-[#f87171] text-sm">
        No se pudo cargar Apple Maps.
      </div>
    )
  }

  return (
    <>
      <style>{`
        .mk-map-view { background: #111827; }
        @keyframes mk-popup-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mk-popup-card { animation: mk-popup-in 160ms ease-out; transform-origin: bottom center; }
      `}</style>

      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={containerRef} className="mk-map-view" style={{ width: '100%', height: '100%', minHeight: '500px' }} />

        {popup && (
          <div ref={cardRef} style={getPopupStyle(popup.x, popup.y)}
            className="mk-popup-card bg-[#161922] border border-[#2a2f3d] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.75)]"
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
