import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        role: body.role,
        status: body.status,
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
    return NextResponse.json(user)
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
    const { id } = await context.params
    const user = await prisma.user.findUnique({
      where: { id }
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 })
  }
}