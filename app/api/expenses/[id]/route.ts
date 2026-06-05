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
    if (body.description   !== undefined) data.description   = body.description
    if (body.category      !== undefined) data.category      = body.category
    if (body.amount        !== undefined) data.amount        = parseFloat(body.amount)
    if (body.expenseDate   !== undefined) data.expenseDate   = new Date(body.expenseDate)
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod || null
    if (body.supplier      !== undefined) data.supplier      = body.supplier || null
    if (body.receiptUrl    !== undefined) data.receiptUrl    = body.receiptUrl || null
    if (body.notes         !== undefined) data.notes         = body.notes || null

    const expense = await prisma.expense.update({ where: { id }, data })
    return NextResponse.json(expense)
  } catch (error) {
    console.error('PATCH /api/expenses/[id]:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
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
    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/expenses/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
