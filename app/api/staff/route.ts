export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (authUser.role === 'user') {
      const staff = await prisma.user.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(staff)
    }

    const staff = await prisma.user.findMany({
      orderBy: { name: 'asc' }
    })
    // Never ship password hashes to the browser, even for admins
    return NextResponse.json(staff.map(({ password, ...rest }) => rest))
  } catch (error) {
    console.error('GET /api/staff:', error)
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    if (body.password && body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // No hardcoded default — generate a random one-time password when the
    // admin leaves the field blank, instead of every new hire sharing the
    // same predictable temp password.
    const generatedPassword = body.password ? null : crypto.randomBytes(9).toString('base64url')
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(body.password || generatedPassword!, 12)

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        password: hashedPassword,
        role: body.role || 'user',
        phone: body.phone || null,
        status: body.status || 'active',
        scheduleType:          body.scheduleType          || null,
        hourlyRate:            body.hourlyRate ? parseFloat(body.hourlyRate) : null,
        payRates:              body.payRates              ?? null,
        taxId:                 body.taxId                 || null,
        taxIdType:             body.taxIdType             || null,
        immigrationStatus:     body.immigrationStatus     || null,
        hireDate:              body.hireDate ? new Date(body.hireDate + 'T12:00:00') : null,
        workPermit:            body.workPermit             ?? null,
        workPermitExpiry:      body.workPermitExpiry ? new Date(body.workPermitExpiry + 'T12:00:00') : null,
        dateOfBirth:           body.dateOfBirth ? new Date(body.dateOfBirth + 'T12:00:00') : null,
        emergencyContactName:  body.emergencyContactName  || null,
        emergencyContactPhone: body.emergencyContactPhone || null,
        notes:                 body.notes                 || null,
      }
    })
    const { password, ...safeUser } = user

    logAudit(authUser, 'create', 'staff', user.id, { name: user.name, role: user.role })

    // Only echoed back when we generated it — an admin-supplied password is
    // already known to them, no need to send it back over the wire again.
    return NextResponse.json(generatedPassword ? { ...safeUser, tempPassword: generatedPassword } : safeUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
}