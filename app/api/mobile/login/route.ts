export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signMobileToken } from '@/lib/mobile-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const password = body.password
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`mlogin:${String(email).toLowerCase()}`) || !checkRateLimit(`mlogin-ip:${ip}`, 30)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
    }

    const token = signMobileToken(user)
    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    console.error('Error in mobile login:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
