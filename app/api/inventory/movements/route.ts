export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { maybeNotifyLowStock } from '@/lib/low-stock'

// Raw SQL: the generated Prisma client predates the InventoryMovement model
// (query engine DLL is locked by the dev server, can't regenerate).

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const where = productId ? `WHERE m."productId" = $1` : ''
    const params = productId ? [productId] : []
    const movements = await prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, m."productId", m.type, m.quantity, m.date, m.comment,
              m."createdBy", m."createdAt",
              p.name AS "productName", p.sku, p."unitOfMeasure"
       FROM inventory_movements m
       JOIN inventory_products p ON p.id = m."productId"
       ${where}
       ORDER BY m.date DESC, m."createdAt" DESC
       LIMIT 300`,
      ...params
    )
    return NextResponse.json(movements)
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

    // Atomic stock update: for 'out', the WHERE guard prevents going below zero
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

    const movementId = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO inventory_movements (id, "productId", type, quantity, date, comment, "createdBy")
       VALUES ($1, $2, $3, $4, $5::timestamp, $6, $7)`,
      movementId, productId, type, quantity, `${dateStr}T12:00:00`, comment || null, authUser.name
    )

    // Low-stock alert if this usage crossed below the minimum
    if (type === 'out') {
      await maybeNotifyLowStock(updated[0], updated[0].currentStock + quantity).catch(() => {})
    }

    return NextResponse.json({ product: updated[0], movementId })
  } catch (error) {
    console.error('POST /api/inventory/movements:', error)
    return NextResponse.json({ error: 'Failed to register movement' }, { status: 500 })
  }
}
