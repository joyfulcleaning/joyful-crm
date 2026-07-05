export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

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
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(body.password || 'joyful2026', 12)

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
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
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
}