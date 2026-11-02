import { prisma } from './prisma'
import { normalizePhone } from './phone'
import { checkAvailability as availabilityHandler } from './ai-handlers'
import {
  type ToolResult,
  clampLimit,
  cleanQuery,
  dateOnly,
  dayName,
  fail,
  isYmd,
  num,
  ok,
  resolveRange,
  today,
  ymd,
} from './assistant-common'

/**
 * Read-only tools exposed to the assistant.
 *
 * These run as an admin and deliberately include prices and financials —
 * unlike the /api/ai/* namespace, whose caller is a customer on the phone and
 * which therefore strips price fields. The audience here is the owner.
 *
 * Payloads stay narrow on purpose: everything returned is spoken aloud or
 * summarized, so wide rows just cost tokens and latency.
 */

export async function getToday(): Promise<ToolResult> {
  const date = today()
  return ok({ date, dayOfWeek: dayName(date), timezone: 'America/New_York' })
}

export async function searchClients(args: { query?: unknown; limit?: unknown }): Promise<ToolResult> {
  const query = cleanQuery(args.query)
  if (!query) return fail('query is required (at least 2 characters)')

  const limit = clampLimit(args.limit, 15, 50)
  const digits = normalizePhone(query)

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { contactName: { contains: query, mode: 'insensitive' } },
        { propertyCode: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, name: true, type: true, status: true, phone: true, contactName: true,
      contactPhone: true, address: true, city: true, state: true, zip: true, frequency: true,
      management: { select: { name: true } },
    },
    take: limit,
    orderBy: { name: 'asc' },
  })

  // Phone search is done in memory because the column holds whatever format was
  // typed in ("(910) 555-1234", "910-555-1234"), so a LIKE on digits misses.
  let phoneMatches: typeof clients = []
  if (digits.length >= 7) {
    const candidates = await prisma.client.findMany({
      where: { OR: [{ phone: { not: null } }, { contactPhone: { not: null } }] },
      select: {
        id: true, name: true, type: true, status: true, phone: true, contactName: true,
        contactPhone: true, address: true, city: true, state: true, zip: true, frequency: true,
        management: { select: { name: true } },
      },
    })
    phoneMatches = candidates.filter(
      c =>
        (c.phone && normalizePhone(c.phone).includes(digits)) ||
        (c.contactPhone && normalizePhone(c.contactPhone).includes(digits))
    )
  }

  const byId = new Map<string, (typeof clients)[number]>()
  for (const c of [...clients, ...phoneMatches]) byId.set(c.id, c)
  const results = [...byId.values()].slice(0, limit)

  return ok({
    count: results.length,
    clients: results.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      phone: c.phone,
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      address: [c.address, c.city, c.state, c.zip].filter(Boolean).join(', '),
      frequency: c.frequency,
      management: c.management?.name ?? null,
    })),
  })
}

export async function getClient(args: { clientId?: unknown }): Promise<ToolResult> {
  if (typeof args.clientId !== 'string') return fail('clientId is required')

  const client = await prisma.client.findUnique({
    where: { id: args.clientId },
    include: {
      management: { select: { name: true } },
      services: {
        select: { id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true, status: true, total: true },
        orderBy: { serviceDate: 'desc' },
        take: 10,
      },
      invoices: {
        select: { id: true, invoiceNumber: true, status: true, total: true, balanceDue: true, dueDate: true },
        orderBy: { issuedAt: 'desc' },
        take: 10,
      },
    },
  })
  if (!client) return fail(`No client with id ${args.clientId}`)

  const outstanding = client.invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + num(i.balanceDue), 0)

  return ok({
    id: client.id,
    name: client.name,
    type: client.type,
    status: client.status,
    phone: client.phone,
    email: client.email,
    contactName: client.contactName,
    contactPhone: client.contactPhone,
    address: [client.address, client.city, client.state, client.zip].filter(Boolean).join(', '),
    propertyCode: client.propertyCode,
    frequency: client.frequency,
    management: client.management?.name ?? null,
    paymentTermsDays: client.paymentTermsDays,
    defaultTaxRate: client.defaultTaxRate ? num(client.defaultTaxRate) : null,
    notes: client.notes,
    outstandingBalance: Number(outstanding.toFixed(2)),
    recentServices: client.services.map(s => ({
      id: s.id,
      number: s.serviceNumber,
      date: ymd(s.serviceDate),
      time: s.serviceTime,
      type: s.type,
      status: s.status,
      total: num(s.total),
    })),
    recentInvoices: client.invoices.map(i => ({
      id: i.id,
      number: i.invoiceNumber,
      status: i.status,
      total: num(i.total),
      balanceDue: num(i.balanceDue),
      dueDate: i.dueDate ? ymd(i.dueDate) : null,
    })),
  })
}

export async function listServices(args: {
  period?: unknown; from?: unknown; to?: unknown; status?: unknown
  clientId?: unknown; staffId?: unknown; type?: unknown; limit?: unknown
}): Promise<ToolResult> {
  const range = resolveRange(
    typeof args.period === 'string' ? args.period : undefined,
    typeof args.from === 'string' ? args.from : undefined,
    typeof args.to === 'string' ? args.to : undefined
  )
  if ('error' in range) return fail(range.error)

  const where: Record<string, unknown> = {
    serviceDate: { gte: dateOnly(range.from), lte: dateOnly(range.to) },
  }
  if (typeof args.status === 'string') where.status = args.status
  if (typeof args.clientId === 'string') where.clientId = args.clientId
  if (typeof args.type === 'string') where.type = { contains: args.type, mode: 'insensitive' }
  if (typeof args.staffId === 'string') where.staff = { some: { userId: args.staffId } }

  const services = await prisma.service.findMany({
    where,
    select: {
      id: true, serviceNumber: true, serviceDate: true, serviceTime: true, type: true,
      address: true, unit: true, status: true, total: true, invoicedAt: true,
      client: { select: { id: true, name: true } },
      staff: { select: { user: { select: { id: true, name: true } } } },
    },
    orderBy: [{ serviceDate: 'asc' }, { serviceTime: 'asc' }],
    take: clampLimit(args.limit, 50, 200),
  })

  const byStatus: Record<string, number> = {}
  for (const s of services) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1

  return ok({
    range,
    count: services.length,
    byStatus,
    totalValue: Number(services.reduce((sum, s) => sum + num(s.total), 0).toFixed(2)),
    services: services.map(s => ({
      id: s.id,
      number: s.serviceNumber,
      date: ymd(s.serviceDate),
      time: s.serviceTime,
      type: s.type,
      client: s.client.name,
      clientId: s.client.id,
      address: [s.address, s.unit].filter(Boolean).join(' '),
      status: s.status,
      total: num(s.total),
      invoiced: s.invoicedAt !== null,
      staff: s.staff.map(st => st.user.name),
    })),
  })
}

export async function getService(args: { serviceId?: unknown; serviceNumber?: unknown }): Promise<ToolResult> {
  const where =
    typeof args.serviceId === 'string'
      ? { id: args.serviceId }
      : typeof args.serviceNumber === 'number'
        ? { serviceNumber: args.serviceNumber }
        : null
  if (!where) return fail('serviceId or serviceNumber is required')

  const service = await prisma.service.findFirst({
    where,
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      staff: { select: { user: { select: { id: true, name: true } } } },
      noteThread: {
        select: { body: true, createdAt: true, author: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
      _count: { select: { photos: true } },
    },
  })
  if (!service) return fail('Service not found')

  return ok({
    id: service.id,
    number: service.serviceNumber,
    date: ymd(service.serviceDate),
    dayOfWeek: dayName(ymd(service.serviceDate)),
    time: service.serviceTime,
    type: service.type,
    status: service.status,
    client: { id: service.client.id, name: service.client.name, phone: service.client.phone, email: service.client.email },
    address: [service.address, service.unit].filter(Boolean).join(' '),
    roomSize: service.roomSize,
    basePrice: num(service.basePrice),
    additionalFee: num(service.additionalFee),
    total: num(service.total),
    paymentMethod: service.paymentMethod,
    frequency: service.frequency,
    invoiced: service.invoicedAt !== null,
    staff: service.staff.map(s => ({ id: s.user.id, name: s.user.name })),
    internalNotes: service.internalNotes,
    completionNotes: service.completionNotes,
    photoCount: service._count.photos,
    notes: service.noteThread.map(n => ({
      author: n.author?.name ?? 'unknown',
      body: n.body,
      at: n.createdAt.toISOString(),
    })),
  })
}

export async function checkAvailability(args: { date?: unknown }): Promise<ToolResult> {
  if (!isYmd(args.date)) return fail('date is required (YYYY-MM-DD)')
  const result = await availabilityHandler(args.date)
  return result.status === 200 ? ok(result.body) : fail(result.body?.error ?? 'Could not check availability')
}

export async function listInvoices(args: {
  status?: unknown; clientId?: unknown; period?: unknown; from?: unknown; to?: unknown
  unpaidOnly?: unknown; limit?: unknown
}): Promise<ToolResult> {
  const where: Record<string, unknown> = {}

  if (typeof args.status === 'string') where.status = args.status
  if (typeof args.clientId === 'string') where.clientId = args.clientId
  if (args.unpaidOnly === true) where.status = { in: ['draft', 'sent', 'overdue'] }

  if (args.period || args.from || args.to) {
    const range = resolveRange(
      typeof args.period === 'string' ? args.period : undefined,
      typeof args.from === 'string' ? args.from : undefined,
      typeof args.to === 'string' ? args.to : undefined
    )
    if ('error' in range) return fail(range.error)
    where.issuedAt = { gte: dateOnly(range.from), lte: new Date(`${range.to}T23:59:59.999Z`) }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true, invoiceNumber: true, status: true, total: true, amountPaid: true, balanceDue: true,
      issuedAt: true, dueDate: true, paidAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { issuedAt: 'desc' },
    take: clampLimit(args.limit, 25, 100),
  })

  return ok({
    count: invoices.length,
    totalBilled: Number(invoices.reduce((s, i) => s + num(i.total), 0).toFixed(2)),
    totalOutstanding: Number(invoices.reduce((s, i) => s + num(i.balanceDue), 0).toFixed(2)),
    invoices: invoices.map(i => ({
      id: i.id,
      number: i.invoiceNumber,
      client: i.client.name,
      clientId: i.client.id,
      status: i.status,
      total: num(i.total),
      amountPaid: num(i.amountPaid),
      balanceDue: num(i.balanceDue),
      issuedAt: ymd(i.issuedAt),
      dueDate: i.dueDate ? ymd(i.dueDate) : null,
      paidAt: i.paidAt ? ymd(i.paidAt) : null,
    })),
  })
}

export async function getInvoice(args: { invoiceId?: unknown; invoiceNumber?: unknown }): Promise<ToolResult> {
  const where =
    typeof args.invoiceId === 'string'
      ? { id: args.invoiceId }
      : typeof args.invoiceNumber === 'string'
        ? { invoiceNumber: args.invoiceNumber }
        : null
  if (!where) return fail('invoiceId or invoiceNumber is required')

  const invoice = await prisma.invoice.findFirst({
    where,
    include: {
      client: { select: { id: true, name: true, email: true } },
      items: { select: { description: true, quantity: true, unitPrice: true, total: true } },
      payments: {
        select: { amount: true, method: true, platform: true, reference: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
      },
    },
  })
  if (!invoice) return fail('Invoice not found')

  return ok({
    id: invoice.id,
    number: invoice.invoiceNumber,
    client: { id: invoice.client.id, name: invoice.client.name, email: invoice.client.email },
    status: invoice.status,
    period: { from: ymd(invoice.periodFrom), to: ymd(invoice.periodTo) },
    subtotal: num(invoice.subtotal),
    additionalFees: num(invoice.additionalFees),
    taxRate: num(invoice.taxRate),
    taxAmount: num(invoice.taxAmount),
    // Shown in the invoice totals block, not as line items — so the model has
    // to read them here or its figures won't add up to the total.
    cardFeeRate: num(invoice.cardFeeRate),
    cardFeeAmount: num(invoice.cardFeeAmount),
    tipAmount: num(invoice.tipAmount),
    total: num(invoice.total),
    amountPaid: num(invoice.amountPaid),
    balanceDue: num(invoice.balanceDue),
    issuedAt: ymd(invoice.issuedAt),
    dueDate: invoice.dueDate ? ymd(invoice.dueDate) : null,
    paidAt: invoice.paidAt ? ymd(invoice.paidAt) : null,
    emailSentAt: invoice.emailSentAt?.toISOString() ?? null,
    notes: invoice.notes,
    items: invoice.items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: num(i.unitPrice),
      total: num(i.total),
    })),
    payments: invoice.payments.map(p => ({
      amount: num(p.amount),
      method: p.method,
      platform: p.platform,
      reference: p.reference,
      paidAt: ymd(p.paidAt),
    })),
  })
}

/**
 * The "how did we do this week" question, answered in one call. Revenue is
 * counted two ways on purpose — services performed vs. payments actually
 * received — because they diverge a lot in this business and quoting the wrong
 * one as "revenue" is misleading.
 */
export async function businessSummary(args: { period?: unknown; from?: unknown; to?: unknown }): Promise<ToolResult> {
  const range = resolveRange(
    typeof args.period === 'string' ? args.period : 'this_week',
    typeof args.from === 'string' ? args.from : undefined,
    typeof args.to === 'string' ? args.to : undefined
  )
  if ('error' in range) return fail(range.error)

  const gte = dateOnly(range.from)
  const lte = dateOnly(range.to)
  const lteEnd = new Date(`${range.to}T23:59:59.999Z`)

  const [services, payments, expenses, newClients, openInvoices, tips] = await Promise.all([
    prisma.service.findMany({
      where: { serviceDate: { gte, lte } },
      select: { status: true, total: true, type: true },
    }),
    prisma.invoicePayment.findMany({
      where: { paidAt: { gte, lte: lteEnd } },
      select: { amount: true, method: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte, lte } },
      select: { amount: true, category: true },
    }),
    prisma.client.count({ where: { createdAt: { gte, lte: lteEnd } } }),
    prisma.invoice.aggregate({
      where: { status: { in: ['draft', 'sent', 'overdue'] } },
      _sum: { balanceDue: true },
      _count: true,
    }),
    // Tips invoiced in the period. Reported on their own because the money
    // belongs to the crew, not the business — it is handed over at payroll.
    prisma.invoice.aggregate({
      where: { issuedAt: { gte, lte: lteEnd }, tipAmount: { gt: 0 } },
      _sum: { tipAmount: true },
      _count: true,
    }),
  ])

  const byStatus: Record<string, number> = {}
  const byType: Record<string, number> = {}
  for (const s of services) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
    byType[s.type] = (byType[s.type] ?? 0) + 1
  }

  const completedValue = services
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + num(s.total), 0)
  const scheduledValue = services
    .filter(s => s.status === 'pending' || s.status === 'in_progress')
    .reduce((sum, s) => sum + num(s.total), 0)
  const collected = payments.reduce((sum, p) => sum + num(p.amount), 0)
  const spent = expenses.reduce((sum, e) => sum + num(e.amount), 0)

  const expensesByCategory: Record<string, number> = {}
  for (const e of expenses) {
    expensesByCategory[e.category] = Number(((expensesByCategory[e.category] ?? 0) + num(e.amount)).toFixed(2))
  }

  return ok({
    range,
    services: {
      total: services.length,
      byStatus,
      byType,
      completedValue: Number(completedValue.toFixed(2)),
      stillScheduledValue: Number(scheduledValue.toFixed(2)),
    },
    cash: {
      collected: Number(collected.toFixed(2)),
      paymentCount: payments.length,
      expenses: Number(spent.toFixed(2)),
      net: Number((collected - spent).toFixed(2)),
      expensesByCategory,
    },
    newClients,
    outstanding: {
      openInvoices: openInvoices._count,
      balanceDue: Number(num(openInvoices._sum.balanceDue).toFixed(2)),
    },
    tips: {
      invoiced: Number(num(tips._sum.tipAmount).toFixed(2)),
      invoiceCount: tips._count,
    },
  })
}

export async function listStaff(args: { includeInactive?: unknown }): Promise<ToolResult> {
  const anchor = today()
  const staff = await prisma.user.findMany({
    where: args.includeInactive === true ? {} : { status: 'active' },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true,
      hourlyRate: true, scheduleType: true,
      _count: { select: { serviceStaff: { where: { service: { serviceDate: dateOnly(anchor) } } } } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return ok({
    date: anchor,
    count: staff.length,
    staff: staff.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      status: s.status,
      hourlyRate: s.hourlyRate ? num(s.hourlyRate) : null,
      scheduleType: s.scheduleType,
      assignmentsToday: s._count.serviceStaff,
    })),
  })
}

export async function listExpenses(args: {
  period?: unknown; from?: unknown; to?: unknown; category?: unknown; limit?: unknown
}): Promise<ToolResult> {
  const range = resolveRange(
    typeof args.period === 'string' ? args.period : 'this_month',
    typeof args.from === 'string' ? args.from : undefined,
    typeof args.to === 'string' ? args.to : undefined
  )
  if ('error' in range) return fail(range.error)

  const where: Record<string, unknown> = {
    expenseDate: { gte: dateOnly(range.from), lte: dateOnly(range.to) },
  }
  if (typeof args.category === 'string') where.category = { contains: args.category, mode: 'insensitive' }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      id: true, expenseNumber: true, description: true, category: true, amount: true,
      expenseDate: true, supplier: true, paymentMethod: true,
    },
    orderBy: { expenseDate: 'desc' },
    take: clampLimit(args.limit, 50, 200),
  })

  return ok({
    range,
    count: expenses.length,
    total: Number(expenses.reduce((s, e) => s + num(e.amount), 0).toFixed(2)),
    expenses: expenses.map(e => ({
      id: e.id,
      number: e.expenseNumber,
      date: ymd(e.expenseDate),
      description: e.description,
      category: e.category,
      amount: num(e.amount),
      supplier: e.supplier,
      paymentMethod: e.paymentMethod,
    })),
  })
}

export async function listInventory(args: { lowStockOnly?: unknown; query?: unknown }): Promise<ToolResult> {
  const query = cleanQuery(args.query)
  const products = await prisma.inventoryProduct.findMany({
    where: query
      ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { sku: { contains: query, mode: 'insensitive' } }] }
      : {},
    select: {
      id: true, sku: true, name: true, category: true, unitOfMeasure: true,
      unitCost: true, currentStock: true, minimumStock: true, supplier: true,
    },
    orderBy: { name: 'asc' },
  })

  const mapped = products.map(p => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unitOfMeasure,
    unitCost: num(p.unitCost),
    currentStock: p.currentStock,
    minimumStock: p.minimumStock,
    // Matches the web app's definition (Finances → Inventory): strictly below.
    lowStock: p.currentStock < p.minimumStock,
    supplier: p.supplier,
  }))

  const filtered = args.lowStockOnly === true ? mapped.filter(p => p.lowStock) : mapped

  return ok({
    count: filtered.length,
    lowStockCount: mapped.filter(p => p.lowStock).length,
    stockValue: Number(mapped.reduce((s, p) => s + p.unitCost * p.currentStock, 0).toFixed(2)),
    products: filtered,
  })
}

/** Everything sitting in an inbox waiting on the admin, in one call. */
export async function listPendingApprovals(): Promise<ToolResult> {
  const [aiRequests, supplyRequests, quoteVisits] = await Promise.all([
    prisma.aiRequest.findMany({
      where: { status: 'pending' },
      select: { id: true, type: true, summary: true, callerName: true, callerPhone: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 25,
    }),
    prisma.supplyRequest.findMany({
      where: { status: 'pending' },
      select: {
        id: true, note: true, neededBy: true, createdAt: true,
        requestedBy: { select: { name: true } },
        items: { select: { requestedQty: true, product: { select: { name: true, currentStock: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    }),
    prisma.estimateVisit.findMany({
      where: { status: 'scheduled', visitDate: { gte: dateOnly(today()) } },
      select: { id: true, name: true, phone: true, address: true, visitDate: true, visitTime: true },
      orderBy: { visitDate: 'asc' },
      take: 25,
    }),
  ])

  return ok({
    phoneAssistantRequests: aiRequests.map(r => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      caller: r.callerName,
      phone: r.callerPhone,
      receivedAt: r.createdAt.toISOString(),
    })),
    supplyRequests: supplyRequests.map(r => ({
      id: r.id,
      requestedBy: r.requestedBy.name,
      note: r.note,
      neededBy: r.neededBy ? ymd(r.neededBy) : null,
      items: r.items.map(i => ({ product: i.product.name, requested: i.requestedQty, inStock: i.product.currentStock })),
    })),
    upcomingEstimateVisits: quoteVisits.map(v => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      address: v.address,
      date: ymd(v.visitDate),
      time: v.visitTime,
    })),
    totalPending: aiRequests.length + supplyRequests.length,
  })
}

// ─────────────────────────────────────────────
// ChatGPT deep-research / company-knowledge pair
// ─────────────────────────────────────────────

/**
 * `search` and `fetch` are the two read-only tools ChatGPT expects when a
 * connector is used for deep research or company knowledge, with this exact
 * shape (results carry id/title/url, fetch takes an id). The richer tools above
 * are what the conversational flow actually uses; these make the same data
 * reachable from those other ChatGPT surfaces.
 */
export async function searchEverything(args: { query?: unknown }): Promise<ToolResult> {
  const query = cleanQuery(args.query)
  if (!query) return fail('query is required (at least 2 characters)')

  const [clients, services, invoices] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, address: true, city: true, status: true },
      take: 10,
    }),
    prisma.service.findMany({
      where: {
        OR: [
          { type: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
          { client: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true, serviceNumber: true, serviceDate: true, serviceTime: true,
        type: true, status: true, client: { select: { name: true } },
      },
      orderBy: { serviceDate: 'desc' },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query, mode: 'insensitive' } },
          { client: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true, invoiceNumber: true, status: true, total: true, balanceDue: true,
        client: { select: { name: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 10,
    }),
  ])

  const results = [
    ...clients.map(c => ({
      id: `client:${c.id}`,
      title: `${c.name} — client`,
      text: `${c.status} client at ${[c.address, c.city].filter(Boolean).join(', ') || 'no address on file'}`,
      url: `/clients/${c.id}`,
    })),
    ...services.map(s => ({
      id: `service:${s.id}`,
      title: `#${s.serviceNumber} ${s.type} — ${s.client.name}`,
      text: `${ymd(s.serviceDate)} at ${s.serviceTime}, status ${s.status}`,
      url: `/services/${s.id}`,
    })),
    ...invoices.map(i => ({
      id: `invoice:${i.id}`,
      title: `Invoice ${i.invoiceNumber} — ${i.client.name}`,
      text: `${i.status}, total ${num(i.total)}, balance due ${num(i.balanceDue)}`,
      url: `/finances/invoices/${i.id}`,
    })),
  ]

  return ok({ results })
}

export async function fetchRecord(args: { id?: unknown }): Promise<ToolResult> {
  if (typeof args.id !== 'string') return fail('id is required')

  const [kind, recordId] = args.id.includes(':') ? args.id.split(':', 2) : ['', args.id]

  switch (kind) {
    case 'client':
      return getClient({ clientId: recordId })
    case 'service':
      return getService({ serviceId: recordId })
    case 'invoice':
      return getInvoice({ invoiceId: recordId })
    default:
      return fail('id must look like "client:<uuid>", "service:<uuid>" or "invoice:<uuid>" — use the search tool to get one')
  }
}
