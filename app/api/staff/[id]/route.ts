export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { parseDateOnly, pickProfileFields, ProfileInputError } from '@/lib/staff-profile-server'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (body.email !== undefined && !String(body.email).trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (body.password && body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    let profile: Record<string, any>
    try {
      profile = pickProfileFields(body.profile)
    } catch (err) {
      if (err instanceof ProfileInputError) return NextResponse.json({ error: err.message }, { status: 400 })
      throw err
    }
    if (profile.supervisorId === id) {
      return NextResponse.json({ error: 'A person cannot supervise themselves' }, { status: 400 })
    }

    let hashedPassword: string | undefined
    if (body.password) {
      const bcrypt = await import('bcryptjs')
      hashedPassword = await bcrypt.hash(body.password, 12)
    }

    // A field the request didn't send stays as it is: undefined means "leave
    // alone" to Prisma, and only an explicit empty value clears a column.
    const opt = (v: any) => (v === undefined ? undefined : v === '' ? null : v ?? null)
    const optDate = (v: any) => (v === undefined ? undefined : parseDateOnly(v))

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        phone: opt(body.phone),
        role: body.role,
        status: body.status,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        scheduleType:          opt(body.scheduleType),
        staffGroupId:          opt(body.staffGroupId),
        hourlyRate:            body.hourlyRate === undefined ? undefined
                                 : body.hourlyRate === null || body.hourlyRate === '' ? null
                                 : parseFloat(body.hourlyRate),
        payRates:              body.payRates === null ? Prisma.DbNull : body.payRates,
        taxId:                 opt(body.taxId),
        taxIdType:             opt(body.taxIdType),
        immigrationStatus:     opt(body.immigrationStatus),
        hireDate:              optDate(body.hireDate),
        workPermit:            body.workPermit,
        workPermitExpiry:      optDate(body.workPermitExpiry),
        dateOfBirth:           optDate(body.dateOfBirth),
        emergencyContactName:  opt(body.emergencyContactName),
        emergencyContactPhone: opt(body.emergencyContactPhone),
        notes:                 opt(body.notes),
        ...(Object.keys(profile).length
          ? { hrProfile: { upsert: { create: profile, update: profile } } }
          : {}),
      },
      include: {
        staffGroup: { select: { id: true, name: true, color: true, sortOrder: true, isActive: true } },
        hrProfile:  true,
      },
    })
    const { password, ...safeUser } = user

    logAudit(authUser, 'update', 'staff', user.id, {
      name: user.name,
      role: user.role,
      status: user.status,
      passwordChanged: !!hashedPassword,
      // Names only: the values include tax IDs and bank details.
      fields: [...Object.keys(body).filter(k => k !== 'profile' && k !== 'password'), ...Object.keys(profile)],
    })

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
      where: { id },
      include: { hrProfile: true },
    })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { password, ...safeUser } = user
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 })
  }
}