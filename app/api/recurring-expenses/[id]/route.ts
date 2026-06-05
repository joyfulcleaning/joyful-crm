export const dynamic = 'force-dynamic'
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
    if (body.name          !== undefined) data.name          = body.name
    if (body.category      !== undefined) data.category      = body.category
    if (body.amount        !== undefined) data.amount        = parseFloat(body.amount)
    if (body.frequency     !== undefined) data.frequency     = body.frequency
    if (body.dayOfMonth    !== undefined) data.dayOfMonth    = body.dayOfMonth ? parseInt(body.dayOfMonth) : null
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null
    if (body.autoRegister  !== undefined) data.autoRegister  = Boolean(body.autoRegister)
    if (body.isActive      !== undefined) data.isActive      = Boolean(body.isActive)
    if (body.notes         !== undefined) data.notes         = body.notes || null

    const recurring = await prisma.recurringExpense.update({ where: { id }, data })
    return NextResponse.json(recurring)
  } catch (error) {
    console.error('PATCH /api/recurring-expenses/[id]:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
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
    await prisma.recurringExpense.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/recurring-expenses/[id]:', error)
    return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 })
  }
}
