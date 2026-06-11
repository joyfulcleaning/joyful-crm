export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        staff: { include: { user: { select: { name: true } } } },
        photos: { orderBy: { uploadedAt: 'asc' } },
        _count: { select: { duplicates: true } },
      }
    })
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(service)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.serviceDate   !== undefined) data.serviceDate   = new Date(body.serviceDate)
    if (body.serviceTime   !== undefined) data.serviceTime   = body.serviceTime
    if (body.type          !== undefined) data.type          = body.type
    if (body.status        !== undefined) data.status        = body.status
    if (body.address       !== undefined) data.address       = body.address
    if (body.unit          !== undefined) data.unit          = body.unit
    if (body.numericKey    !== undefined) data.numericKey    = body.numericKey
    if (body.roomSize      !== undefined) data.roomSize      = body.roomSize
    if (body.frequency     !== undefined) data.frequency     = body.frequency
    if (body.basePrice     !== undefined) data.basePrice     = parseFloat(body.basePrice)
    if (body.additionalFee !== undefined) data.additionalFee = parseFloat(body.additionalFee) || 0
    if (body.total         !== undefined) data.total         = parseFloat(body.total)
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null
    if (body.internalNotes !== undefined) data.internalNotes = body.internalNotes
    if (body.staffNotes    !== undefined) data.staffNotes    = body.staffNotes
    if (body.clientId)                    data.client        = { connect: { id: body.clientId } }

    const service = await prisma.service.update({ where: { id }, data })

    if (body.staffIds) {
      await prisma.serviceStaff.deleteMany({ where: { serviceId: id } })
      if (body.staffIds.length > 0) {
        await prisma.serviceStaff.createMany({
          data: body.staffIds.map((userId: string) => ({ serviceId: id, userId }))
        })
      }
    }

    // ── Apply to future series members ────────────────────────────
    if (body.applyToSeries) {
      const today = new Date(); today.setHours(0, 0, 0, 0)

      // Find root: if this is a child, parent is root; if root itself, use its own id
      const self = await prisma.service.findUnique({ where: { id }, select: { parentServiceId: true } })
      const rootId = self?.parentServiceId ?? id

      const futureSiblings = await prisma.service.findMany({
        where: {
          OR: [{ id: rootId }, { parentServiceId: rootId }],
          serviceDate: { gte: today },
          id: { not: id },
          status: { notIn: ['completed', 'cancelled'] },
        },
        select: { id: true },
      })

      const siblingIds = futureSiblings.map(s => s.id)

      if (siblingIds.length > 0) {
        // Build propagation payload (no date / status / client changes)
        const bulkData: Record<string, unknown> = {}
        if (body.type          !== undefined) bulkData.type          = body.type
        if (body.serviceTime   !== undefined) bulkData.serviceTime   = body.serviceTime
        if (body.address       !== undefined) bulkData.address       = body.address
        if (body.unit          !== undefined) bulkData.unit          = body.unit
        if (body.numericKey    !== undefined) bulkData.numericKey    = body.numericKey
        if (body.roomSize      !== undefined) bulkData.roomSize      = body.roomSize
        if (body.frequency     !== undefined) bulkData.frequency     = body.frequency
        if (body.basePrice     !== undefined) bulkData.basePrice     = parseFloat(body.basePrice)
        if (body.additionalFee !== undefined) bulkData.additionalFee = parseFloat(body.additionalFee) || 0
        if (body.total         !== undefined) bulkData.total         = parseFloat(body.total)
        if (body.paymentMethod !== undefined) bulkData.paymentMethod = body.paymentMethod || null
        if (body.internalNotes !== undefined) bulkData.internalNotes = body.internalNotes
        if (body.staffNotes    !== undefined) bulkData.staffNotes    = body.staffNotes

        if (Object.keys(bulkData).length > 0) {
          await prisma.service.updateMany({ where: { id: { in: siblingIds } }, data: bulkData })
        }

        if (body.staffIds) {
          for (const sibId of siblingIds) {
            await prisma.serviceStaff.deleteMany({ where: { serviceId: sibId } })
            if (body.staffIds.length > 0) {
              await prisma.serviceStaff.createMany({
                data: body.staffIds.map((userId: string) => ({ serviceId: sibId, userId }))
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ ...service, updatedSiblings: body.applyToSeries ?? false })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        invoiceItems: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, status: true } }
          }
        }
      }
    })

    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Bloquea si está en un invoice que no sea draft
    const activeInvoices = service.invoiceItems
      .filter(item => item.invoice && item.invoice.status !== 'draft')
      .map(item => item.invoice?.invoiceNumber)

    if (activeInvoices.length > 0) {
      return NextResponse.json({
        error: `This service is part of invoice(s): ${activeInvoices.join(', ')}. Delete the invoice first.`
      }, { status: 400 })
    }

    await prisma.service.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}