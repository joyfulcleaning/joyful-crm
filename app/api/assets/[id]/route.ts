import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()
    const data: any = {}
    if (body.name               !== undefined) data.name               = body.name
    if (body.type               !== undefined) data.type               = body.type
    if (body.purchaseDate       !== undefined) data.purchaseDate       = new Date(body.purchaseDate)
    if (body.purchaseValue      !== undefined) data.purchaseValue      = parseFloat(body.purchaseValue)
    if (body.currentValue       !== undefined) data.currentValue       = parseFloat(body.currentValue)
    if (body.annualDepreciation !== undefined) data.annualDepreciation = parseFloat(body.annualDepreciation)
    if (body.serialNumber       !== undefined) data.serialNumber       = body.serialNumber || null
    if (body.status             !== undefined) data.status             = body.status
    if (body.notes              !== undefined) data.notes              = body.notes || null

    const asset = await prisma.asset.update({ where: { id }, data })
    return NextResponse.json(asset)
  } catch (error) {
    console.error('PATCH /api/assets/[id]:', error)
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    await prisma.asset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/assets/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
  }
}
