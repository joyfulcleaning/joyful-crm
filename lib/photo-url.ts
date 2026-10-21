/**
 * Rewrites a stored photo URL to ask Supabase for a resized copy.
 *
 * Supabase serves the untouched original from /object/public/ and a transformed
 * one from /render/image/public/. The galleries were pointing 100px thumbnails
 * at originals straight off an iPhone camera — 2 MB on average, 15 MB at worst —
 * so every time someone opened a service the full captures came down the wire
 * again. That is what drained the project's egress quota and what made the app
 * crawl on mobile data.
 *
 * The originals stay exactly as they are in storage and in ServicePhoto.url;
 * only what gets *rendered* is scaled down. Downloads and shares keep handing
 * out the original, which is the copy worth keeping.
 *
 * A URL that isn't a public Supabase object — a video, a blob: preview, an
 * older absolute link — is returned untouched.
 */
const PUBLIC_OBJECT = '/storage/v1/object/public/'
const RENDER_IMAGE  = '/storage/v1/render/image/public/'

function transformed(url: string, params: Record<string, string | number>): string {
  if (!url || !url.includes(PUBLIC_OBJECT)) return url
  // Drop any existing query so repeated calls can't stack transform params.
  const base  = url.split('?')[0].replace(PUBLIC_OBJECT, RENDER_IMAGE)
  const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return `${base}?${query}`
}

/**
 * Square grid thumbnail. `cover` crops to fill the tile, matching the
 * object-cover the grid already applies.
 */
export function thumbUrl(url: string, size = 400): string {
  return transformed(url, { width: size, height: size, resize: 'cover', quality: 60 })
}

/**
 * Full-screen view. `contain` fits the photo inside the box instead of cropping
 * it, so both dimensions are given — a portrait shot comes back 1050×1400
 * rather than squared off.
 */
export function viewUrl(url: string, size = 1400): string {
  return transformed(url, { width: size, height: size, resize: 'contain', quality: 80 })
}
