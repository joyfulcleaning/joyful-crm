import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calendar/:path*',
    '/map/:path*',
    '/services/:path*',
    '/clients/:path*',
    '/staff/:path*',
    '/finances/:path*',
    '/analytics/:path*',
    '/export/:path*',
    '/settings/:path*',
  ],
}