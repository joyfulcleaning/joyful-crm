import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Joyful Services CRM',
    short_name: 'Joyful CRM',
    description: 'Cleaning Business Management System — Joyful Services LLC',
    start_url: '/',
    display: 'standalone',
    background_color: '#161922',
    theme_color: '#4A3FB0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
