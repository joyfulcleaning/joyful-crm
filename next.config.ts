import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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