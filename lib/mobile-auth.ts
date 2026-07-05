import jwt from 'jsonwebtoken'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'

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

function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string }
    return payload.sub
  } catch {
    return null
  }
}

/**
 * Resolves the requesting user from a NextAuth web session (cookie), a mobile
 * Bearer token, or a `?token=` query param (only way for the mobile app to
 * open PDFs in the device browser, where headers can't be set). Single entry
 * point so permission logic stays consistent.
 *
 * The resolved id is always re-checked against the database: role and name
 * come fresh from the User row, and anyone whose status is no longer `active`
 * is rejected immediately instead of at token expiry (mobile tokens last 180
 * days).
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  let candidateId: string | null = null

  const session = await getServerSession(authOptions)
  if (session?.user) {
    candidateId = (session.user as any).id ?? null
  }

  if (!candidateId) {
    const authHeader = request.headers.get('authorization') || ''
    const match = authHeader.match(/^Bearer (.+)$/)
    const token = match?.[1] ?? new URL(request.url).searchParams.get('token')
    if (token) candidateId = verifyToken(token)
  }

  if (!candidateId) return null

  const user = await prisma.user.findUnique({
    where: { id: candidateId },
    select: { id: true, role: true, name: true, status: true },
  })
  if (!user || user.status !== 'active') return null

  return { id: user.id, role: user.role as 'admin' | 'user', name: user.name }
}
