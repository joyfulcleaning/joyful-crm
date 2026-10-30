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
  // OAuth discovery documents for the ChatGPT/MCP connector. They have to live
  // at these exact /.well-known paths (RFC 9728 / RFC 8414), and a literal
  // `app/.well-known/` directory is not a dependable route segment because the
  // leading dot marks it hidden — so they are rewritten onto normal API routes.
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/oauth/protected-resource',
      },
      // RFC 9728 path insertion: clients may append the resource path, e.g.
      // /.well-known/oauth-protected-resource/api/assistant/mcp
      {
        source: '/.well-known/oauth-protected-resource/:path*',
        destination: '/api/oauth/protected-resource',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/oauth/authorization-server',
      },
      {
        source: '/.well-known/oauth-authorization-server/:path*',
        destination: '/api/oauth/authorization-server',
      },
      // Some clients probe for OIDC discovery before falling back to RFC 8414.
      {
        source: '/.well-known/openid-configuration',
        destination: '/api/oauth/authorization-server',
      },
    ]
  },
}

export default nextConfig