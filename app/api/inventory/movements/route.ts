export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { maybeNotifyLowStock } from '@/lib/low-stock'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const movements = await prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { name: true, sku: true, unitOfMeasure: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })

    return NextResponse.json(movements.map(m => ({
      id: m.id,
      productId: m.productId,
      type: m.type,
      quantity: m.quantity,
      date: m.date,
      comment: m.comment,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
      productName: m.product.name,
      sku: m.product.sku,
      unitOfMeasure: m.product.unitOfMeasure,
    })))
  } catch (error) {
    console.error('GET /api/inventory/movements:', error)
    return NextResponse.json({ error: 'Failed to load movements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { productId, type, comment } = body
    const quantity = parseInt(body.quantity)

    if (!productId || !['out', 'in'].includes(type)) {
      return NextResponse.json({ error: 'productId and type (out/in) are required' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive whole number' }, { status: 400 })
    }
    const dateStr = body.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Atomic stock update via raw SQL: Prisma's update API can't express a
    // conditional WHERE on the current column value in one statement, and
    // this guard is what prevents stock from going negative under concurrent
    // requests. For 'out', the guard rejects the update if stock is insufficient.
    const delta = type === 'out' ? -quantity : quantity
    const updated = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE inventory_products
       SET "currentStock" = "currentStock" + $1, "updatedAt" = NOW()
       WHERE id = $2 ${type === 'out' ? 'AND "currentStock" >= $3' : ''}
       RETURNING *`,
      delta, productId, ...(type === 'out' ? [quantity] : [])
    )
    if (updated.length === 0) {
      const exists = await prisma.inventoryProduct.findUnique({ where: { id: productId }, select: { currentStock: true } })
      if (!exists) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      return NextResponse.json(
        { error: `Not enough stock: only ${exists.currentStock} available` },
        { status: 409 }
      )
    }

    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        type,
        quantity,
        date: new Date(`${dateStr}T12:00:00`),
        comment: comment || null,
        createdBy: authUser.name,
      },
    })

    // Low-stock alert if this usage crossed below the minimum
    if (type === 'out') {
      await maybeNotifyLowStock(updated[0], updated[0].currentStock + quantity).catch(() => {})
    }

    return NextResponse.json({ product: updated[0], movementId: movement.id })
  } catch (error) {
    console.error('POST /api/inventory/movements:', error)
    return NextResponse.json({ error: 'Failed to register movement' }, { status: 500 })
  }
}
