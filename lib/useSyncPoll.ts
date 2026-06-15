import { useEffect, useRef } from 'react'

type SyncStatus = Record<string, string>

/** Polls /api/sync-status and calls onChange only when one of `keys` changed since the last check. */
export function useSyncPoll(keys: string[], onChange: () => void, intervalMs = 8000) {
  const lastRef = useRef<SyncStatus | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const keysKey = keys.join(',')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/sync-status')
        if (!res.ok) return
        const data: SyncStatus = await res.json()
        if (cancelled) return
        const prev = lastRef.current
        lastRef.current = data
        if (prev && keysKey.split(',').some(k => data[k] !== prev[k])) {
          onChangeRef.current()
        }
      } catch {}
    }
    const id = setInterval(check, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [keysKey, intervalMs])
}
