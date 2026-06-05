export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EXTRA_FEE_TYPES = new Set(['Deep Clean', 'Heavy Deep Clean'])

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates required' }, { status: 400 })
    }

    const fromDate = new Date(from + 'T00:00:00')
    const toDate   = new Date(to   + 'T23:59:59')

    // Get all active staff (non-admin)
    const staffList = await prisma.user.findMany({
      where: { role: 'user', status: 'active' },
      orderBy: { name: 'asc' },
    })

    const results = await Promise.all(staffList.map(async (user) => {
      const freq = user.scheduleType || 'weekly'

      if (freq === 'daily' || freq === 'per_service') {
        // Fetch all service assignments for this user in the date range
        const assignments = await prisma.serviceStaff.findMany({
          where: {
            userId: user.id,
            service: {
              serviceDate: { gte: fromDate, lte: toDate },
              status: { not: 'cancelled' },
            },
          },
          include: {
            service: {
              select: { serviceDate: true, roomSize: true, type: true },
            },
          },
        })

        if (freq === 'daily') {
          // Unique calendar dates (YYYY-MM-DD) where they had at least 1 service
          const daySet = new Set<string>()
          for (const a of assignments) {
            const d = a.service.serviceDate
            if (d) daySet.add(new Date(d).toISOString().split('T')[0])
          }
          const workedDays = Array.from(daySet).sort()
          const rate       = Number(user.hourlyRate) || 0
          const baseAmount = workedDays.length * rate

          return {
            ...userBase(user),
            workedDays,
            workedDaysCount: workedDays.length,
            count1BR: 0, count2BR: 0, count3BR: 0, countExtra: 0,
            baseAmount,
          }
        }

        // per_service
        const rates = (user.payRates as any) || {}
        let count1BR = 0, count2BR = 0, count3BR = 0, countExtra = 0

        for (const a of assignments) {
          const rs   = a.service.roomSize
          const type = a.service.type
          if (rs === '1BR') count1BR++
          else if (rs === '2BR') count2BR++
          else if (rs === '3BR') count3BR++
          if (EXTRA_FEE_TYPES.has(type || '')) countExtra++
        }

        const baseAmount =
          (Number(rates.per1BR)   || 0) * count1BR  +
          (Number(rates.per2BR)   || 0) * count2BR  +
          (Number(rates.per3BR)   || 0) * count3BR  +
          (Number(rates.extraFee) || 0) * countExtra

        return {
          ...userBase(user),
          workedDays: [], workedDaysCount: 0,
          count1BR, count2BR, count3BR, countExtra,
          baseAmount: parseFloat(baseAmount.toFixed(2)),
        }
      }

      // Fixed schedule (weekly / biweekly / monthly)
      const rate = Number(user.hourlyRate) || 0
      return {
        ...userBase(user),
        workedDays: [], workedDaysCount: 0,
        count1BR: 0, count2BR: 0, count3BR: 0, countExtra: 0,
        baseAmount: rate,
      }
    }))

    return NextResponse.json(results)
  } catch (error) {
    console.error('Payroll calculate error:', error)
    return NextResponse.json({ error: 'Failed to calculate payroll' }, { status: 500 })
  }
}

function userBase(user: any) {
  return {
    userId:       user.id,
    name:         user.name,
    scheduleType: user.scheduleType,
    hourlyRate:   user.hourlyRate ? Number(user.hourlyRate) : null,
    payRates:     user.payRates ?? null,
  }
}
