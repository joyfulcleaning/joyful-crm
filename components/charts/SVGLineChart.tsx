'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineDataset {
  label: string
  data: number[]
  color: string
  fill?: string       // area fill color; omit for no fill
  dashed?: boolean    // dashed stroke (secondary line)
  dotRadius?: number  // dot size; 0 = no dots; default 2.5 (primary) / 2 (secondary)
}

interface Props {
  labels: string[]
  datasets: LineDataset[]
  gridColor: string
  textColor: string
  showLegend?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNiceTicks(rawMin: number, rawMax: number): number[] {
  const absMax = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1)
  const steps = [1,2,5,10,25,50,100,200,250,500,1000,2000,2500,5000,10000,25000,50000]
  const step = steps.find(s => s >= absMax / 4) ?? 50000
  const niceMin = rawMin < 0 ? -Math.ceil(Math.abs(rawMin) / step) * step : 0
  const niceMax = Math.ceil(rawMax / step) * step
  const out: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.01; v += step) out.push(Math.round(v))
  return out
}

function curvedPath(pts: { x: number; y: number }[], t = 0.4): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i]
    const p2 = pts[i + 1],              p3 = pts[Math.min(pts.length - 1, i + 2)]
    const f = t / 3
    d += ` C${(p1.x+(p2.x-p0.x)*f).toFixed(1)},${(p1.y+(p2.y-p0.y)*f).toFixed(1)} ${(p2.x-(p3.x-p1.x)*f).toFixed(1)},${(p2.y-(p3.y-p1.y)*f).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function curvedAreaPath(pts: { x: number; y: number }[], baseline: number, t = 0.4): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x.toFixed(1)},${baseline.toFixed(1)} L${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i]
    const p2 = pts[i + 1],              p3 = pts[Math.min(pts.length - 1, i + 2)]
    const f = t / 3
    d += ` C${(p1.x+(p2.x-p0.x)*f).toFixed(1)},${(p1.y+(p2.y-p0.y)*f).toFixed(1)} ${(p2.x-(p3.x-p1.x)*f).toFixed(1)},${(p2.y-(p3.y-p1.y)*f).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d + ` L${pts[pts.length-1].x.toFixed(1)},${baseline.toFixed(1)} Z`
}

function fmtTick(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}k`
  return `${sign}$${abs}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SVGLineChart({
  labels, datasets, gridColor, textColor, showLegend = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 220 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setSize({ w: el.offsetWidth || 600, h: el.offsetHeight || 220 })
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (!labels.length || !datasets.length) return null

  const { w: vw, h: vh } = size
  const P = { top: showLegend ? 28 : 16, right: 16, bottom: 26, left: 46 }
  const pw = vw - P.left - P.right
  const ph = vh - P.top - P.bottom

  const allValues = datasets.flatMap(d => d.data)
  const rawMin = Math.min(0, ...allValues)
  const rawMax = Math.max(0, ...allValues)
  const ticks = buildNiceTicks(rawMin, rawMax)
  const minV = ticks[0], maxV = ticks[ticks.length - 1]
  const range = maxV - minV || 1

  const n = labels.length
  const xOf = (i: number) => P.left + (n > 1 ? (i / (n - 1)) * pw : pw / 2)
  const yOf = (v: number) => P.top + (1 - (v - minV) / range) * ph
  const baseline = yOf(0)

  const xStep = Math.max(1, Math.ceil(n / 10))
  const xLabels = labels
    .map((l, i) => ({ l, x: xOf(i) }))
    .filter((_, i) => i % xStep === 0 || i === n - 1)

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${vw} ${vh}`} style={{ width: '100%', height: '100%' }}>

        {/* Grid */}
        <g style={{ opacity: 0, animation: 'caFade .5s ease .1s both' }}>
          {ticks.map((t, i) => (
            <line key={i}
              x1={P.left} y1={yOf(t).toFixed(1)} x2={P.left + pw} y2={yOf(t).toFixed(1)}
              stroke={gridColor} strokeWidth={t === 0 ? 1.5 : 0.8}
            />
          ))}
        </g>

        {/* Datasets */}
        {datasets.map((ds, di) => {
          const coords = ds.data.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
          const line   = curvedPath(coords)
          const area   = ds.fill ? curvedAreaPath(coords, baseline) : null
          const dr     = ds.dotRadius !== undefined ? ds.dotRadius : (di === 0 ? 2.5 : 2)

          if (di === 0) {
            return (
              <g key={di}>
                {area && (
                  <path d={area} fill={ds.fill}
                    style={{ opacity: 0, animation: 'caFade .9s ease .35s both' }} />
                )}
                <path d={line} fill="none" stroke={ds.color} strokeWidth={2} strokeLinejoin="round"
                  pathLength="1"
                  style={{ strokeDasharray: '1', animation: 'caDraw 1.6s cubic-bezier(.45,.05,.35,1) .25s both' } as any}
                />
                {dr > 0 && (
                  <g style={{ opacity: 0, animation: 'caFade .35s ease 1.85s both' }}>
                    {coords.map((pt, i) => (
                      <circle key={i} cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)} r={dr} fill={ds.color} />
                    ))}
                  </g>
                )}
              </g>
            )
          }

          // Secondary dataset: wipes in after primary finishes
          return (
            <g key={di} style={{ animation: 'caWipe 1.7s cubic-bezier(.45,.05,.35,1) 1.05s both' } as any}>
              {area && <path d={area} fill={ds.fill} />}
              <path d={line} fill="none" stroke={ds.color} strokeWidth={1.8} strokeLinejoin="round"
                strokeDasharray={ds.dashed ? '5 3' : undefined} />
              {dr > 0 && coords.map((pt, i) => (
                <circle key={i} cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)} r={dr} fill={ds.color} />
              ))}
            </g>
          )
        })}

        {/* Y-axis labels */}
        <g style={{ opacity: 0, animation: 'caFade .6s ease .2s both' }}>
          {ticks.map((t, i) => (
            <text key={i} x={P.left - 5} y={(yOf(t) + 3.5).toFixed(1)}
              textAnchor="end" fill={textColor} fontSize={9.5}>
              {fmtTick(t)}
            </text>
          ))}
        </g>

        {/* X-axis labels */}
        <g style={{ opacity: 0, animation: 'caFade .6s ease .2s both' }}>
          {xLabels.map((l, i) => (
            <text key={i} x={l.x.toFixed(1)} y={(P.top + ph + 15).toFixed(1)}
              textAnchor="middle" fill={textColor} fontSize={9.5}>{l.l}</text>
          ))}
        </g>

        {/* Legend (optional) */}
        {showLegend && (
          <g style={{ opacity: 0, animation: 'caFade .5s ease .1s both' }}>
            {datasets.map((ds, i) => {
              const lx = P.left + i * 90
              return (
                <g key={i}>
                  {ds.dashed
                    ? <line x1={lx} y1={9.5} x2={lx+12} y2={9.5} stroke={ds.color} strokeWidth={1.8} strokeDasharray="4 2" />
                    : <rect x={lx} y={8} width={12} height={3} fill={ds.color} rx={1} />
                  }
                  <text x={lx + 15} y={12} fill={textColor} fontSize={9.5}>{ds.label}</text>
                </g>
              )
            })}
          </g>
        )}

      </svg>
    </div>
  )
}
