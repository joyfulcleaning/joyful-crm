import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Standard working days per period — used to compute daily rate for proration
const STD_DAYS: Record<string, number> = {
  daily:    1,
  weekly:   5,
  biweekly: 10,
  monthly:  22,
}

export async function GET() {
  try {
    const records = await prisma.payrollRecord.findMany({
      include: {
        staff: { select: { id: true, name: true, scheduleType: true, hourlyRate: true } },
        createdBy: { select: { name: true } },
        expense: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(records)
  } catch (error) {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const adminUser = await prisma.user.findUnique({
      where: { email: session?.user?.email || 'admin@joyfulcleaning.com' }
    })
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staff = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const freq = staff.scheduleType || 'weekly'
    const periodFrom = new Date(body.periodFrom + 'T12:00:00')
    const periodTo   = new Date(body.periodTo   + 'T12:00:00')
    const payDate    = new Date(body.payDate     + 'T12:00:00')

    // If the client sends an explicit overrideAmount (e.g. from adjustment), use it
    const overrideAmount: number | null =
      body.overrideAmount != null ? parseFloat(body.overrideAmount) : null

    let netPay: number
    let daysWorked: number | null = null
    let servicesCount: number | null = null
    let paymentType: 'hourly' | 'fixed_day' | 'per_job' = 'fixed_day'
    let noteDetail: string
    let rate: number

    if (freq === 'per_service') {
      // Per-service calculation
      const rates = (staff.payRates as any) || {}
      const n1BR     = parseInt(body.count1BR     || '0') || 0
      const n2BR     = parseInt(body.count2BR     || '0') || 0
      const n3BR     = parseInt(body.count3BR     || '0') || 0
      const nExtra   = parseInt(body.countExtra   || '0') || 0
      const p1BR     = Number(rates.per1BR   || 0)
      const p2BR     = Number(rates.per2BR   || 0)
      const p3BR     = Number(rates.per3BR   || 0)
      const pExtra   = Number(rates.extraFee || 0)

      netPay         = p1BR * n1BR + p2BR * n2BR + p3BR * n3BR + pExtra * nExtra
      servicesCount  = n1BR + n2BR + n3BR
      rate           = 0
      paymentType    = 'per_job'
      noteDetail     = `1BR×${n1BR}($${p1BR}) + 2BR×${n2BR}($${p2BR}) + 3BR×${n3BR}($${p3BR}) + Extra×${nExtra}($${pExtra})`
    } else {
      // Fixed / daily / weekly / biweekly / monthly
      rate         = Number(staff.hourlyRate) || 0
      const d      = parseInt(body.daysWorked || '0') || STD_DAYS[freq] || 5
      daysWorked   = d
      const std    = STD_DAYS[freq] || 5
      netPay       = freq === 'daily'
        ? rate * d
        : d < std ? parseFloat((rate * d / std).toFixed(2)) : rate
      const dates: string[] = freq === 'daily' && Array.isArray(body.workedDates) ? body.workedDates : []
      noteDetail   = dates.length > 0 ? `dates:${dates.join(',')}` : `${d} days worked`
    }

    netPay = overrideAmount != null ? overrideAmount : parseFloat(netPay.toFixed(2))

    // Create the expense
    const expense = await prisma.expense.create({
      data: {
        description:   `Payroll – ${staff.name}`,
        category:      'payroll',
        amount:        netPay,
        expenseDate:   payDate,
        paymentMethod: body.paymentMethod || 'check',
        supplier:      staff.name,
        notes:         `Pay period: ${body.periodFrom} to ${body.periodTo} · ${noteDetail}`,
        createdById:   adminUser.id,
      }
    })

    // Create the payroll record
    const payroll = await prisma.payrollRecord.create({
      data: {
        userId:        staff.id,
        periodFrom,
        periodTo,
        paymentType,
        daysWorked,
        servicesCount,
        rate:          rate ?? 0,
        basePay:       netPay,
        bonus:         0,
        deductions:    0,
        netPay,
        paymentMethod: body.paymentMethod || 'check',
        status:        'paid',
        payDate,
        expenseId:     expense.id,
        createdById:   adminUser.id,
        analysisNotes: [noteDetail, body.notes].filter(Boolean).join(' · '),
      },
      include: {
        staff:   { select: { id: true, name: true } },
        expense: { select: { id: true } },
      }
    })

    return NextResponse.json(payroll)
  } catch (error) {
    console.error('Payroll error:', error)
    return NextResponse.json({ error: 'Failed to process payroll' }, { status: 500 })
  }
}
