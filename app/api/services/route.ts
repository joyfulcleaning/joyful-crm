export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { getVisibleServiceDates, stripPriceFields } from '@/lib/serviceVisibility'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')
    const cal  = searchParams.get('cal') === '1'

    const dateFilter = from && to ? {
      serviceDate: {
        gte: new Date(from + 'T00:00:00.000Z'),
        lte: new Date(to   + 'T23:59:59.999Z'),
      }
    } : {}

    const where = authUser.role === 'user'
      ? {
          serviceDate: { in: getVisibleServiceDates().map(d => new Date(d)) },
          staff: { some: { userId: authUser.id } },
        }
      : dateFilter

    const services = await prisma.service.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true }
        },
        staff: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        ...(!cal ? {
          invoiceItems: {
            select: {
              invoice: { select: { id: true, invoiceNumber: true } }
            },
            take: 1,
          },
        } : {}),
        _count: {
          select: { duplicates: true }
        },
      },
      orderBy: [
        { serviceDate: 'desc' },
        { serviceTime: 'asc' },
      ]
    })

    const result = authUser.role === 'user' ? services.map(stripPriceFields) : services
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json([], { status: 200 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    const { count } = await prisma.service.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: count })
  } catch (error) {
    console.error('Error bulk deleting services:', error)
    return NextResponse.json({ error: 'Failed to delete services' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const user = await prisma.user.findUnique({
      where: { email: session?.user?.email || 'admin@joyfulcleaning.com' }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const service = await prisma.service.create({
      data: {
        client: {
          connect: { id: body.clientId }
        },
        createdBy: {
          connect: { id: user.id }
        },
        serviceDate: new Date(body.serviceDate),
        serviceTime: body.serviceTime,
        type: body.type,
        status: body.status || 'pending',
        address: body.address,
        unit: body.unit || null,
        numericKey: body.numericKey || null,
        roomSize: body.roomSize || null,
        frequency: body.frequency || null,
        parentService: body.parentServiceId ? { connect: { id: body.parentServiceId } } : undefined,
        basePrice: parseFloat(body.basePrice),
        additionalFee: parseFloat(body.additionalFee) || 0,
        total: parseFloat(body.total),
        paymentMethod: body.paymentMethod,
        internalNotes: body.notes,
        staffNotes: body.staffNotes || null,
      }
    })

    if (body.staffIds && body.staffIds.length > 0) {
      await prisma.serviceStaff.createMany({
        data: body.staffIds.map((userId: string) => ({
          serviceId: service.id,
          userId,
        }))
      })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}