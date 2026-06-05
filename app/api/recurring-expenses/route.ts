export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const recurring = await prisma.recurringExpense.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(recurring)
  } catch (error) {
    console.error('GET /api/recurring-expenses:', error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const startDate = new Date(body.startDate)
    let nextDueAt: Date | null = null

    if (body.frequency === 'monthly' && body.dayOfMonth) {
      nextDueAt = new Date(startDate.getFullYear(), startDate.getMonth(), parseInt(body.dayOfMonth))
      if (nextDueAt < new Date()) {
        nextDueAt.setMonth(nextDueAt.getMonth() + 1)
      }
    } else {
      nextDueAt = startDate
    }

    const recurring = await prisma.recurringExpense.create({
      data: {
        name:          body.name,
        category:      body.category,
        amount:        parseFloat(body.amount),
        frequency:     body.frequency || 'monthly',
        dayOfMonth:    body.dayOfMonth ? parseInt(body.dayOfMonth) : null,
        paymentMethod: body.paymentMethod || null,
        autoRegister:  body.autoRegister !== false,
        startDate,
        isActive:      true,
        notes:         body.notes || null,
        nextDueAt,
      },
    })
    return NextResponse.json(recurring)
  } catch (error) {
    console.error('POST /api/recurring-expenses:', error)
    return NextResponse.json({ error: 'Failed to create recurring expense' }, { status: 500 })
  }
}
