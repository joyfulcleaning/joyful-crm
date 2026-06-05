import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search   = searchParams.get('search')
    const receipt  = searchParams.get('receipt')
    const month    = searchParams.get('month') // YYYY-MM

    const where: any = {}
    if (category) where.category = category
    if (receipt === 'yes') where.receiptUrl = { not: null }
    if (receipt === 'no')  where.OR = [{ receiptUrl: null }, { receiptUrl: '' }]
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const from = new Date(y, m - 1, 1)
      const to   = new Date(y, m, 0)
      where.expenseDate = { gte: from, lte: to }
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      include: { recurringSource: { select: { name: true } } },
    })
    return NextResponse.json(expenses)
  } catch (error) {
    console.error('GET /api/expenses:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    let createdById: string
    if (session?.user) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })
      createdById = u?.id ?? ''
    } else {
      const admin = await prisma.user.findUnique({ where: { email: 'admin@joyfulcleaning.com' }, select: { id: true } })
      createdById = admin?.id ?? ''
    }
    if (!createdById) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    const body = await request.json()
    const expense = await prisma.expense.create({
      data: {
        description:   body.description,
        category:      body.category,
        amount:        parseFloat(body.amount),
        expenseDate:   new Date(body.expenseDate),
        paymentMethod: body.paymentMethod || null,
        supplier:      body.supplier || null,
        receiptUrl:    body.receiptUrl || null,
        recurringId:   body.recurringId || null,
        notes:         body.notes || null,
        createdById,
      },
    })
    return NextResponse.json(expense)
  } catch (error) {
    console.error('POST /api/expenses:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
