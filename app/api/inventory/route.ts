import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const products = await prisma.inventoryProduct.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(products)
  } catch (error) {
    console.error('GET /api/inventory:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    let sku = body.sku?.trim()
    if (!sku) {
      const prefix = (body.name as string).slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PRD'
      const count = await prisma.inventoryProduct.count()
      sku = `${prefix}-${String(count + 1).padStart(3, '0')}`
    }

    const product = await prisma.inventoryProduct.create({
      data: {
        sku,
        name:          body.name,
        category:      body.category,
        unitOfMeasure: body.unitOfMeasure,
        unitCost:      parseFloat(body.unitCost),
        currentStock:  parseInt(body.currentStock) || 0,
        minimumStock:  parseInt(body.minimumStock) || 0,
        supplier:      body.supplier || null,
        notes:         body.notes || null,
      },
    })
    return NextResponse.json(product)
  } catch (error: any) {
    console.error('POST /api/inventory:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
