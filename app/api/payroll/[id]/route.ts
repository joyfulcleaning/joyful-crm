export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(_request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const record = await prisma.payrollRecord.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.payrollRecord.delete({ where: { id } })
    if (record.expenseId) {
      await prisma.expense.delete({ where: { id: record.expenseId } }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete payroll error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id }  = await context.params
    const body    = await request.json()

    const record = await prisma.payrollRecord.update({
      where: { id },
      data: {
        ...(body.payDate        && { payDate:       new Date(body.payDate + 'T12:00:00') }),
        ...(body.paymentMethod  && { paymentMethod: body.paymentMethod }),
        ...(body.netPay  != null && { netPay: parseFloat(body.netPay), basePay: parseFloat(body.netPay) }),
        ...(body.analysisNotes !== undefined && { analysisNotes: body.analysisNotes }),
      },
    })

    // Keep linked expense in sync
    if (record.expenseId) {
      await prisma.expense.update({
        where: { id: record.expenseId },
        data: {
          ...(body.netPay       != null && { amount:        parseFloat(body.netPay) }),
          ...(body.paymentMethod        && { paymentMethod: body.paymentMethod }),
          ...(body.payDate              && { expenseDate:   new Date(body.payDate + 'T12:00:00') }),
        },
      }).catch(() => {})
    }

    return NextResponse.json(record)
  } catch (error) {
    console.error('Update payroll error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
