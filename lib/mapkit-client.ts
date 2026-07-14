'use client'

// Singleton loader for MapKit JS — the script tag + mapkit.init() only need
// to run once per page load. Both the map view and the address geocoder
// share this promise so they never race to init twice.
let mapkitPromise: Promise<any> | null = null

export function loadMapKit(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('MapKit JS is client-only'))
  if (mapkitPromise) return mapkitPromise

  mapkitPromise = new Promise((resolve, reject) => {
    function init() {
      const mapkit = (window as any).mapkit
      if (!mapkit) { reject(new Error('MapKit JS failed to load')); return }
      mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          fetch('/api/mapkit-token')
            .then(r => r.json())
            .then(data => {
              if (!data.token) throw new Error(data.error || 'No token returned')
              done(data.token)
            })
            .catch(reject)
        },
      })
      resolve(mapkit)
    }

    if ((window as any).mapkit) { init(); return }

    const script = document.createElement('script')
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'
    script.crossOrigin = 'anonymous'
    script.async = true
    script.onload = init
    script.onerror = () => reject(new Error('Failed to load MapKit JS'))
    document.head.appendChild(script)
  })

  return mapkitPromise
}
