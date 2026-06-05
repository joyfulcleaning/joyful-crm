export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function calcNextDueDate(from: Date, frequency: string, dayOfMonth?: number | null): Date {
  const d = new Date(from)
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7);        break
    case 'biweekly':  d.setDate(d.getDate() + 14);       break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      if (dayOfMonth) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(dayOfMonth, daysInMonth))
      }
      break
    case 'quarterly': d.setMonth(d.getMonth() + 3);     break
    case 'annual':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

async function registerDueExpenses() {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const dueRecurring = await prisma.recurringExpense.findMany({
    where: {
      isActive:     true,
      autoRegister: true,
      nextDueAt:    { lte: today },
    },
  })

  if (dueRecurring.length === 0) return { registered: 0 }

  const adminUser = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
  })
  if (!adminUser) throw new Error('No admin user found')

  let registered = 0

  for (const rec of dueRecurring) {
    let nextDue = rec.nextDueAt!
    let lastRegistered: Date | null = rec.lastRegisteredAt

    // Register all missed occurrences up to today (handles downtime gaps)
    while (nextDue <= today) {
      await prisma.expense.create({
        data: {
          description:   rec.name,
          category:      rec.category,
          amount:        rec.amount,
          expenseDate:   nextDue,
          paymentMethod: rec.paymentMethod ?? null,
          recurringId:   rec.id,
          notes:         'Auto-registered',
          createdById:   adminUser.id,
        },
      })
      lastRegistered = nextDue
      nextDue = calcNextDueDate(nextDue, rec.frequency, rec.dayOfMonth)
      registered++
    }

    await prisma.recurringExpense.update({
      where: { id: rec.id },
      data:  { lastRegisteredAt: lastRegistered, nextDueAt: nextDue },
    })
  }

  return { registered }
}

// Vercel Cron calls GET — protected by CRON_SECRET in production
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await registerDueExpenses()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Cron register-recurring-expenses:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// Manual trigger from UI (no secret needed — protected by session in calling page)
export async function POST() {
  try {
    const result = await registerDueExpenses()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Manual register-recurring-expenses:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
