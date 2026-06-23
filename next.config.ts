import type { NextConfig } from 'next'

process.env.TZ = 'America/New_York'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', '@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/invoices/[id]/email': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/invoices/[id]/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/estimates/[id]/email': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/estimates/[id]/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/estimates/send-email': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig