// Fixed-window rate limiter kept in process memory. On Vercel each serverless
// instance has its own window, so this slows brute force rather than hard-capping
// it globally — enough for login endpoints without adding an external store.
type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()
const MAX_KEYS = 5000

function pruneExpired(now: number) {
  for (const [key, w] of windows) {
    if (now >= w.resetAt) windows.delete(key)
  }
}

/**
 * Returns true if the caller is still within `limit` attempts for the current
 * window, false once the limit is exceeded.
 */
export function checkRateLimit(key: string, limit = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  if (windows.size > MAX_KEYS) pruneExpired(now)

  const w = windows.get(key)
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  w.count += 1
  return w.count <= limit
}
