'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}

export default function CountUp({ value, format, duration = 650, className }: Props) {
  const [current, setCurrent] = useState(0)
  const frameRef  = useRef<number>()
  const stateRef  = useRef({ from: 0, target: 0, startTime: 0 })

  useEffect(() => {
    cancelAnimationFrame(frameRef.current!)
    stateRef.current = { from: current, target: value, startTime: performance.now() }

    function tick() {
      const { from, target, startTime } = stateRef.current
      const elapsed  = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCurrent(from + (target - from) * eased)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current!)
  }, [value])

  const display = format ? format(current) : Math.round(current).toLocaleString('en-US')
  return <span className={className}>{display}</span>
}
