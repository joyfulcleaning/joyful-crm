export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { maybeNotifyLowStock } from '@/lib/low-stock'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()
    const data: any = {}
    if (body.sku           !== undefined) data.sku           = body.sku
    if (body.name          !== undefined) data.name          = body.name
    if (body.category      !== undefined) data.category      = body.category
    if (body.unitOfMeasure !== undefined) data.unitOfMeasure = body.unitOfMeasure
    if (body.unitCost      !== undefined) data.unitCost      = parseFloat(body.unitCost)
    if (body.currentStock  !== undefined) data.currentStock  = parseInt(body.currentStock)
    if (body.minimumStock  !== undefined) data.minimumStock  = parseInt(body.minimumStock)
    if (body.supplier      !== undefined) data.supplier      = body.supplier || null
    if (body.notes         !== undefined) data.notes         = body.notes || null

    const before = data.currentStock !== undefined
      ? await prisma.inventoryProduct.findUnique({ where: { id }, select: { currentStock: true } })
      : null

    const product = await prisma.inventoryProduct.update({ where: { id }, data })

    // Low-stock alert if a manual stock edit crossed below the minimum
    if (before) {
      await maybeNotifyLowStock(product as any, before.currentStock).catch(() => {})
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('PATCH /api/inventory/[id]:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    await prisma.inventoryProduct.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/inventory/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
