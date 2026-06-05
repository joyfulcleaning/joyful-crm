'use client'
import { useEffect } from 'react'
import { applyTheme, getTheme } from '@/lib/theme'

export default function ThemeApplicator() {
  useEffect(() => {
    applyTheme(getTheme())

    const handler = (e: Event) => {
      const { theme } = (e as CustomEvent).detail
      applyTheme(theme)
    }
    window.addEventListener('theme-change', handler)
    return () => window.removeEventListener('theme-change', handler)
  }, [])

  return null
}
