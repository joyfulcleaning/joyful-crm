export async function fetchJsonOrThrow(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}
