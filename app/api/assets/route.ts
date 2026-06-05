export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(assets)
  } catch (error) {
    console.error('GET /api/assets:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const asset = await prisma.asset.create({
      data: {
        name:               body.name,
        type:               body.type,
        purchaseDate:       new Date(body.purchaseDate),
        purchaseValue:      parseFloat(body.purchaseValue),
        currentValue:       parseFloat(body.currentValue ?? body.purchaseValue),
        annualDepreciation: parseFloat(body.annualDepreciation) || 0,
        serialNumber:       body.serialNumber || null,
        status:             body.status || 'active',
        notes:              body.notes || null,
      },
    })
    return NextResponse.json(asset)
  } catch (error) {
    console.error('POST /api/assets:', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}
