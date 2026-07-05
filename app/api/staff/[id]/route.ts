export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    let hashedPassword: string | undefined
    if (body.password) {
      const bcrypt = await import('bcryptjs')
      hashedPassword = await bcrypt.hash(body.password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        role: body.role,
        status: body.status,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        scheduleType:          body.scheduleType          ?? null,
        hourlyRate:            body.hourlyRate != null ? parseFloat(body.hourlyRate) : null,
        payRates:              body.payRates              ?? null,
        taxId:                 body.taxId                 ?? null,
        taxIdType:             body.taxIdType             ?? null,
        immigrationStatus:     body.immigrationStatus     ?? null,
        hireDate:              body.hireDate ? new Date(body.hireDate + 'T12:00:00') : null,
        workPermit:            body.workPermit             ?? null,
        workPermitExpiry:      body.workPermitExpiry ? new Date(body.workPermitExpiry + 'T12:00:00') : null,
        dateOfBirth:           body.dateOfBirth ? new Date(body.dateOfBirth + 'T12:00:00') : null,
        emergencyContactName:  body.emergencyContactName  ?? null,
        emergencyContactPhone: body.emergencyContactPhone ?? null,
        notes:                 body.notes                 ?? null,
      }
    })
    const { password, ...safeUser } = user
    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Error updating staff:', error)
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const user = await prisma.user.findUnique({
      where: { id }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { password, ...safeUser } = user
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 })
  }
}