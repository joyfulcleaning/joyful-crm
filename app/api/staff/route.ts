import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const staff = await prisma.user.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 })
  }
}