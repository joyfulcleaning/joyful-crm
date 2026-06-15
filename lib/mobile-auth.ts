import jwt from 'jsonwebtoken'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export type AuthUser = {
  id: string
  role: 'admin' | 'user'
  name: string
}

const SECRET = process.env.NEXTAUTH_SECRET as string
const MOBILE_TOKEN_EXPIRY = '180d'

export function signMobileToken(user: { id: string; role: string; name: string }) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, SECRET, {
    expiresIn: MOBILE_TOKEN_EXPIRY,
  })
}

/**
 * Resolves the requesting user from either a NextAuth web session (cookie)
 * or a mobile Bearer token. Single entry point so permission logic stays consistent.
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const sessionUser = session.user as any
    return { id: sessionUser.id, role: sessionUser.role, name: sessionUser.name }
  }

  const authHeader = request.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) return null

  try {
    const payload = jwt.verify(match[1], SECRET) as { sub: string; role: 'admin' | 'user'; name: string }
    return { id: payload.sub, role: payload.role, name: payload.name }
  } catch {
    return null
  }
}
