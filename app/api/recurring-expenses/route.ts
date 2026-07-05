export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const recurring = await prisma.recurringExpense.findMany({
      where:   { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(recurring)
  } catch (error) {
    console.error('GET /api/recurring-expenses:', error)
    return NextResponse.json({ error: 'Failed to load recurring expenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
