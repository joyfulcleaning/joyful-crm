import { prisma } from './prisma'
import { logAudit } from './audit'
import { businessToday } from './business-date'
import { maybeNotifyLowStock } from './low-stock'
import { PRIVATE_CUSTOMER_NAME, calcPrices, calcPrivatePrices } from './pricing'
import { HOURLY_SLOTS, isWorkingDay } from './scheduling'
import type { AuthUser } from './mobile-auth'
import {
  type ToolResult,
  dateOnly,
  dayName,
  fail,
  isYmd,
  num,
  ok,
  ymd,
} from './assistant-common'

/**
 * Write tools exposed to the assistant.
 *
 * Two safety rules hold across all of them:
 *
 *  1. Every mutation is written to the audit log with `via: 'assistant'` and
 *     the client name, so a change made through ChatGPT is distinguishable
 *     from one made in the web app or on mobile.
 *  2. The genuinely hard-to-undo operations — cancelling a service, recording
 *     a payment, adjusting stock — refuse to run without `confirm: true`, and
 *     return a preview of the change instead. That check lives here rather
 *     than in the prompt because an instruction the model can forget is not a
 *     safety control.
 */

export type WriteContext = { actor: AuthUser; clientName: string }

async function audit(
  ctx: WriteContext,
  action: 'create' | 'update' | 'delete',
  entity: string,
  entityId: string | null,
  details: Record<string, unknown>
) {
  await logAudit(ctx.actor, action, entity, entityId, { via: 'assistant', assistant: ctx.clientName, ...details })
}

function needsConfirmation(summary: string, preview: Record<string, unknown>): ToolResult {
  return ok({
    confirmationRequired: true,
    summary,
    preview,
    howToProceed: 'Read this back to the user, then call the same tool again with confirm: true.',
  })
}

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────

export async function createService(
  ctx: WriteContext,
  args: {
    clientId?: unknown; serviceDate?: unknown; serviceTime?: unknown; type?: unknown
    address?: unknown; unit?: unknown; roomSize?: unknown; frequency?: unknown
    basePrice?: unknown; additionalFee?: unknown; notes?: unknown
    staffIds?: unknown; sendReminder?: unknown; allowDoubleBooking?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.clientId !== 'string') return fail('clientId is required — use search_clients first')
  if (!isYmd(args.serviceDate)) return fail('serviceDate is required (YYYY-MM-DD)')
  if (typeof args.serviceTime !== 'string') return fail('serviceTime is required (HH:MM, e.g. 09:00)')
  if (typeof args.type !== 'string' || !args.type.trim()) return fail('type is required (e.g. "Standard Clean")')

  const client = await prisma.client.findUnique({
    where: { id: args.clientId },
    include: { management: true },
  })
  if (!client) return fail(`No client with id ${args.clientId}`)

  if (!HOURLY_SLOTS.includes(args.serviceTime)) {
    return fail(`serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}`)
  }
  if (!isWorkingDay(args.serviceDate)) {
    return fail(`${args.serviceDate} is a ${dayName(args.serviceDate)} — the crew works Monday to Friday. Pick another day or override by scheduling it anyway in the web app.`)
  }

  const conflict = await prisma.service.findFirst({
    where: {
      serviceDate: dateOnly(args.serviceDate),
      serviceTime: args.serviceTime,
      status: { not: 'cancelled' },
    },
    select: { id: true, serviceNumber: true, client: { select: { name: true } } },
  })
  if (conflict && args.allowDoubleBooking !== true) {
    return fail(
      `That slot is taken by #${conflict.serviceNumber} (${conflict.client.name}). Pick another time, or pass allowDoubleBooking: true to schedule both.`
    )
  }

  // Explicit prices win; otherwise fall back to the client's configured rates,
  // the same way the web form does.
  let basePrice = typeof args.basePrice === 'number' ? args.basePrice : null
  let additionalFee = typeof args.additionalFee === 'number' ? args.additionalFee : null
  if (basePrice === null) {
    const priced =
      client.management?.name === PRIVATE_CUSTOMER_NAME
        ? calcPrivatePrices(client, typeof args.frequency === 'string' ? args.frequency : 'one_time')
        : calcPrices(client, args.type, typeof args.roomSize === 'string' ? args.roomSize : '')
    basePrice = priced?.base ?? 0
    if (additionalFee === null) additionalFee = priced?.fee ?? 0
  }
  additionalFee = additionalFee ?? 0

  const staffIds = Array.isArray(args.staffIds) ? args.staffIds.filter((s): s is string => typeof s === 'string') : []
  if (staffIds.length > 0) {
    const found = await prisma.user.count({ where: { id: { in: staffIds }, status: 'active' } })
    if (found !== staffIds.length) return fail('One or more staffIds are not active users — use list_staff to get valid ids')
  }

  const service = await prisma.service.create({
    data: {
      client: { connect: { id: client.id } },
      createdBy: { connect: { id: ctx.actor.id } },
      serviceDate: dateOnly(args.serviceDate),
      serviceTime: args.serviceTime,
      type: args.type.trim(),
      address: typeof args.address === 'string' ? args.address : client.address,
      unit: typeof args.unit === 'string' ? args.unit : null,
      roomSize: typeof args.roomSize === 'string' ? args.roomSize : null,
      frequency: (typeof args.frequency === 'string' ? args.frequency : 'one_time') as never,
      basePrice,
      additionalFee,
      total: basePrice + additionalFee,
      sendReminder: args.sendReminder === true,
      internalNotes: typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim() : null,
      ...(staffIds.length > 0 ? { staff: { create: staffIds.map(userId => ({ userId })) } } : {}),
    },
    include: { staff: { select: { user: { select: { name: true } } } } },
  })

  await audit(ctx, 'create', 'service', service.id, {
    serviceNumber: service.serviceNumber,
    client: client.name,
    date: args.serviceDate,
    time: args.serviceTime,
    type: service.type,
    total: num(service.total),
  })

  return ok({
    created: true,
    id: service.id,
    number: service.serviceNumber,
    client: client.name,
    date: args.serviceDate,
    dayOfWeek: dayName(args.serviceDate),
    time: service.serviceTime,
    type: service.type,
    total: num(service.total),
    staff: service.staff.map(s => s.user.name),
    doubleBooked: Boolean(conflict),
  })
}

export async function updateService(
  ctx: WriteContext,
  args: {
    serviceId?: unknown; serviceDate?: unknown; serviceTime?: unknown; status?: unknown
    type?: unknown; basePrice?: unknown; additionalFee?: unknown
    notes?: unknown; paymentMethod?: unknown; confirm?: unknown; allowDoubleBooking?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.serviceId !== 'string') return fail('serviceId is required')

  const service = await prisma.service.findUnique({
    where: { id: args.serviceId },
    include: { client: { select: { name: true } } },
  })
  if (!service) return fail('Service not found')

  const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled', 'reschedule']
  if (args.status !== undefined && (typeof args.status !== 'string' || !VALID_STATUS.includes(args.status))) {
    return fail(`status must be one of: ${VALID_STATUS.join(', ')}`)
  }

  const data: Record<string, unknown> = {}
  const changes: string[] = []

  if (args.serviceDate !== undefined || args.serviceTime !== undefined) {
    const newDate = args.serviceDate !== undefined ? args.serviceDate : ymd(service.serviceDate)
    const newTime = args.serviceTime !== undefined ? args.serviceTime : service.serviceTime
    if (!isYmd(newDate)) return fail('serviceDate must be YYYY-MM-DD')
    if (typeof newTime !== 'string' || !HOURLY_SLOTS.includes(newTime)) {
      return fail(`serviceTime must be one of: ${HOURLY_SLOTS.join(', ')}`)
    }
    if (!isWorkingDay(newDate)) {
      return fail(`${newDate} is a ${dayName(newDate)} — the crew works Monday to Friday.`)
    }

    const conflict = await prisma.service.findFirst({
      where: {
        id: { not: service.id },
        serviceDate: dateOnly(newDate),
        serviceTime: newTime,
        status: { not: 'cancelled' },
      },
      select: { serviceNumber: true, client: { select: { name: true } } },
    })
    if (conflict && args.allowDoubleBooking !== true) {
      return fail(`That slot is taken by #${conflict.serviceNumber} (${conflict.client.name}). Pass allowDoubleBooking: true to move it anyway.`)
    }

    data.serviceDate = dateOnly(newDate)
    data.serviceTime = newTime
    changes.push(`moved to ${newDate} ${dayName(newDate)} at ${newTime}`)
  }

  if (typeof args.status === 'string' && args.status !== service.status) {
    data.status = args.status
    changes.push(`status ${service.status} → ${args.status}`)
    if (args.status === 'completed') data.completedAt = new Date()
  }

  if (typeof args.type === 'string' && args.type.trim()) {
    data.type = args.type.trim()
    changes.push(`type → ${args.type.trim()}`)
  }

  if (typeof args.basePrice === 'number' || typeof args.additionalFee === 'number') {
    const base = typeof args.basePrice === 'number' ? args.basePrice : num(service.basePrice)
    const fee = typeof args.additionalFee === 'number' ? args.additionalFee : num(service.additionalFee)
    data.basePrice = base
    data.additionalFee = fee
    data.total = base + fee
    changes.push(`total ${num(service.total)} → ${base + fee}`)
  }

  if (typeof args.paymentMethod === 'string') {
    data.paymentMethod = args.paymentMethod
    changes.push(`payment method → ${args.paymentMethod}`)
  }

  if (typeof args.notes === 'string' && args.notes.trim()) {
    data.internalNotes = service.internalNotes
      ? `${service.internalNotes}\n${args.notes.trim()}`
      : args.notes.trim()
    changes.push('note appended')
  }

  if (changes.length === 0) return fail('Nothing to change — pass at least one field to update')

  // Cancelling is the one update that destroys scheduled work and may already
  // have been communicated to the client, so it needs an explicit confirmation.
  if (args.status === 'cancelled' && args.confirm !== true) {
    return needsConfirmation(
      `Cancel service #${service.serviceNumber} for ${service.client.name} on ${ymd(service.serviceDate)} at ${service.serviceTime}?`,
      {
        serviceNumber: service.serviceNumber,
        client: service.client.name,
        date: ymd(service.serviceDate),
        time: service.serviceTime,
        type: service.type,
        total: num(service.total),
        alreadyInvoiced: service.invoicedAt !== null,
      }
    )
  }

  const updated = await prisma.service.update({ where: { id: service.id }, data })

  await audit(ctx, 'update', 'service', service.id, {
    serviceNumber: service.serviceNumber,
    client: service.client.name,
    changes,
  })

  return ok({
    updated: true,
    id: updated.id,
    number: updated.serviceNumber,
    client: service.client.name,
    date: ymd(updated.serviceDate),
    time: updated.serviceTime,
    status: updated.status,
    total: num(updated.total),
    changes,
  })
}

export async function assignStaff(
  ctx: WriteContext,
  args: { serviceId?: unknown; staffIds?: unknown; replace?: unknown }
): Promise<ToolResult> {
  if (typeof args.serviceId !== 'string') return fail('serviceId is required')
  const staffIds = Array.isArray(args.staffIds) ? args.staffIds.filter((s): s is string => typeof s === 'string') : []
  if (staffIds.length === 0) return fail('staffIds must be a non-empty array of user ids — use list_staff')

  const service = await prisma.service.findUnique({
    where: { id: args.serviceId },
    select: { id: true, serviceNumber: true, serviceDate: true, client: { select: { name: true } } },
  })
  if (!service) return fail('Service not found')

  const users = await prisma.user.findMany({
    where: { id: { in: staffIds }, status: 'active' },
    select: { id: true, name: true },
  })
  if (users.length !== staffIds.length) return fail('One or more staffIds are not active users')

  if (args.replace === true) {
    await prisma.serviceStaff.deleteMany({ where: { serviceId: service.id } })
  }

  await prisma.serviceStaff.createMany({
    data: staffIds.map(userId => ({ serviceId: service.id, userId })),
    skipDuplicates: true,
  })

  const assigned = await prisma.serviceStaff.findMany({
    where: { serviceId: service.id },
    select: { user: { select: { name: true } } },
  })

  await audit(ctx, 'update', 'service', service.id, {
    serviceNumber: service.serviceNumber,
    changes: [`staff ${args.replace === true ? 'replaced with' : 'added'}: ${users.map(u => u.name).join(', ')}`],
  })

  return ok({
    updated: true,
    serviceNumber: service.serviceNumber,
    client: service.client.name,
    date: ymd(service.serviceDate),
    staff: assigned.map(a => a.user.name),
  })
}

export async function addServiceNote(
  ctx: WriteContext,
  args: { serviceId?: unknown; body?: unknown }
): Promise<ToolResult> {
  if (typeof args.serviceId !== 'string') return fail('serviceId is required')
  if (typeof args.body !== 'string' || !args.body.trim()) return fail('body is required')

  const service = await prisma.service.findUnique({
    where: { id: args.serviceId },
    select: { id: true, serviceNumber: true },
  })
  if (!service) return fail('Service not found')

  const note = await prisma.serviceNote.create({
    data: { serviceId: service.id, authorId: ctx.actor.id, body: args.body.trim() },
  })

  await audit(ctx, 'create', 'service_note', note.id, { serviceNumber: service.serviceNumber })

  return ok({ created: true, serviceNumber: service.serviceNumber, body: note.body })
}

// ─────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────

export async function createClient(
  ctx: WriteContext,
  args: {
    name?: unknown; type?: unknown; phone?: unknown; email?: unknown
    address?: unknown; city?: unknown; state?: unknown; zip?: unknown
    contactName?: unknown; contactPhone?: unknown; frequency?: unknown; notes?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.name !== 'string' || !args.name.trim()) return fail('name is required')

  const name = args.name.trim()
  const duplicate = await prisma.client.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true, address: true },
  })
  if (duplicate) {
    return fail(`A client named "${duplicate.name}" already exists (id ${duplicate.id}). Use update_client, or pick a more specific name.`)
  }

  const privateMgmt = await prisma.management.findUnique({ where: { name: PRIVATE_CUSTOMER_NAME } })

  const client = await prisma.client.create({
    data: {
      name,
      type: (typeof args.type === 'string' ? args.type : 'residential') as never,
      phone: typeof args.phone === 'string' ? args.phone : null,
      email: typeof args.email === 'string' ? args.email : null,
      address: typeof args.address === 'string' ? args.address : null,
      city: typeof args.city === 'string' ? args.city : undefined,
      state: typeof args.state === 'string' ? args.state : undefined,
      zip: typeof args.zip === 'string' ? args.zip : null,
      contactName: typeof args.contactName === 'string' ? args.contactName : null,
      contactPhone: typeof args.contactPhone === 'string' ? args.contactPhone : null,
      frequency: (typeof args.frequency === 'string' ? args.frequency : null) as never,
      notes: typeof args.notes === 'string' ? args.notes : null,
      managementId: privateMgmt?.id ?? null,
    },
  })

  await audit(ctx, 'create', 'client', client.id, { name: client.name, phone: client.phone })

  return ok({
    created: true,
    id: client.id,
    name: client.name,
    type: client.type,
    phone: client.phone,
    address: [client.address, client.city, client.state, client.zip].filter(Boolean).join(', '),
  })
}

export async function updateClient(
  ctx: WriteContext,
  args: {
    clientId?: unknown; name?: unknown; phone?: unknown; email?: unknown
    address?: unknown; city?: unknown; state?: unknown; zip?: unknown
    contactName?: unknown; contactPhone?: unknown; frequency?: unknown
    status?: unknown; notes?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.clientId !== 'string') return fail('clientId is required')

  const client = await prisma.client.findUnique({ where: { id: args.clientId } })
  if (!client) return fail('Client not found')

  const data: Record<string, unknown> = {}
  const changes: string[] = []
  const simpleFields = ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'contactName', 'contactPhone', 'status', 'notes'] as const

  for (const field of simpleFields) {
    const value = args[field]
    if (typeof value === 'string' && value !== (client as Record<string, unknown>)[field]) {
      data[field] = value
      changes.push(`${field} → ${value}`)
    }
  }
  if (typeof args.frequency === 'string') {
    data.frequency = args.frequency
    changes.push(`frequency → ${args.frequency}`)
  }

  if (changes.length === 0) return fail('Nothing to change — pass at least one field to update')

  const updated = await prisma.client.update({ where: { id: client.id }, data })
  await audit(ctx, 'update', 'client', client.id, { name: updated.name, changes })

  return ok({ updated: true, id: updated.id, name: updated.name, changes })
}

// ─────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────

/**
 * Recording a payment moves an invoice toward paid and feeds the financial
 * reports, so it always needs confirmation — a misheard amount over a car
 * speakerphone is both easy and expensive.
 */
export async function recordInvoicePayment(
  ctx: WriteContext,
  args: {
    invoiceId?: unknown; amount?: unknown; method?: unknown; platform?: unknown
    reference?: unknown; notes?: unknown; paidAt?: unknown; confirm?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.invoiceId !== 'string') return fail('invoiceId is required')
  if (typeof args.amount !== 'number' || !(args.amount > 0)) return fail('amount must be a positive number')
  if (typeof args.method !== 'string') {
    return fail('method is required (cash, zelle, venmo, paypal, cashapp, check, ach, card, credit_card, eft)')
  }
  if (args.paidAt !== undefined && !isYmd(args.paidAt)) return fail('paidAt must be YYYY-MM-DD')

  const invoice = await prisma.invoice.findUnique({
    where: { id: args.invoiceId },
    include: { client: { select: { name: true } } },
  })
  if (!invoice) return fail('Invoice not found')

  const balance = num(invoice.balanceDue)
  if (args.amount > balance + 0.01) {
    return fail(`Amount ${args.amount} exceeds the balance due of ${balance} on invoice ${invoice.invoiceNumber}. Record ${balance} to settle it, or check the invoice first.`)
  }

  if (args.confirm !== true) {
    return needsConfirmation(
      `Record a ${args.amount} ${args.method} payment against invoice ${invoice.invoiceNumber} for ${invoice.client.name}?`,
      {
        invoice: invoice.invoiceNumber,
        client: invoice.client.name,
        invoiceTotal: num(invoice.total),
        alreadyPaid: num(invoice.amountPaid),
        balanceDue: balance,
        paymentAmount: args.amount,
        balanceAfter: Number((balance - args.amount).toFixed(2)),
        method: args.method,
      }
    )
  }

  const amountPaid = num(invoice.amountPaid) + args.amount
  const balanceDue = Number((num(invoice.total) - amountPaid).toFixed(2))
  const settled = balanceDue <= 0.01

  const [payment] = await prisma.$transaction([
    prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: args.amount,
        method: args.method as never,
        platform: (typeof args.platform === 'string' ? args.platform : 'other') as never,
        reference: typeof args.reference === 'string' ? args.reference : null,
        notes: typeof args.notes === 'string' ? args.notes : null,
        createdById: ctx.actor.id,
        paidAt: isYmd(args.paidAt) ? dateOnly(args.paidAt) : businessToday(),
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid,
        balanceDue: settled ? 0 : balanceDue,
        status: settled ? 'paid' : invoice.status,
        paidAt: settled ? businessToday() : invoice.paidAt,
      },
    }),
  ])

  await audit(ctx, 'create', 'invoice_payment', payment.id, {
    invoice: invoice.invoiceNumber,
    client: invoice.client.name,
    amount: args.amount,
    method: args.method,
    settled,
  })

  return ok({
    recorded: true,
    invoice: invoice.invoiceNumber,
    client: invoice.client.name,
    amount: args.amount,
    amountPaid,
    balanceDue: settled ? 0 : balanceDue,
    status: settled ? 'paid' : invoice.status,
    fullySettled: settled,
  })
}

export async function createExpense(
  ctx: WriteContext,
  args: {
    description?: unknown; category?: unknown; amount?: unknown; expenseDate?: unknown
    supplier?: unknown; paymentMethod?: unknown; notes?: unknown
  }
): Promise<ToolResult> {
  if (typeof args.description !== 'string' || !args.description.trim()) return fail('description is required')
  if (typeof args.category !== 'string' || !args.category.trim()) return fail('category is required (e.g. Supplies, Fuel, Payroll)')
  if (typeof args.amount !== 'number' || !(args.amount > 0)) return fail('amount must be a positive number')
  if (args.expenseDate !== undefined && !isYmd(args.expenseDate)) return fail('expenseDate must be YYYY-MM-DD')

  const expense = await prisma.expense.create({
    data: {
      description: args.description.trim(),
      category: args.category.trim(),
      amount: args.amount,
      expenseDate: isYmd(args.expenseDate) ? dateOnly(args.expenseDate) : businessToday(),
      supplier: typeof args.supplier === 'string' ? args.supplier : null,
      paymentMethod: (typeof args.paymentMethod === 'string' ? args.paymentMethod : null) as never,
      notes: typeof args.notes === 'string' ? args.notes : null,
      createdById: ctx.actor.id,
    },
  })

  await audit(ctx, 'create', 'expense', expense.id, {
    expenseNumber: expense.expenseNumber,
    description: expense.description,
    amount: num(expense.amount),
    category: expense.category,
  })

  return ok({
    created: true,
    id: expense.id,
    number: expense.expenseNumber,
    description: expense.description,
    category: expense.category,
    amount: num(expense.amount),
    date: ymd(expense.expenseDate),
  })
}

// ─────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────

/**
 * Stock movements are append-only in this CRM (the movement log is the audit
 * trail), so a wrong adjustment can only be corrected by another movement —
 * hence the confirmation.
 */
export async function adjustInventory(
  ctx: WriteContext,
  args: { productId?: unknown; type?: unknown; quantity?: unknown; comment?: unknown; confirm?: unknown }
): Promise<ToolResult> {
  if (typeof args.productId !== 'string') return fail('productId is required — use list_inventory')
  if (args.type !== 'in' && args.type !== 'out') return fail('type must be "in" (restock) or "out" (usage)')
  if (typeof args.quantity !== 'number' || !Number.isInteger(args.quantity) || args.quantity < 1) {
    return fail('quantity must be a positive whole number')
  }

  const product = await prisma.inventoryProduct.findUnique({ where: { id: args.productId } })
  if (!product) return fail('Product not found')

  const delta = args.type === 'in' ? args.quantity : -args.quantity
  const newStock = product.currentStock + delta
  if (newStock < 0) {
    return fail(`Only ${product.currentStock} ${product.unitOfMeasure} of ${product.name} in stock — cannot take out ${args.quantity}.`)
  }

  if (args.confirm !== true) {
    return needsConfirmation(
      `${args.type === 'in' ? 'Add' : 'Remove'} ${args.quantity} ${product.unitOfMeasure} ${args.type === 'in' ? 'to' : 'from'} ${product.name}?`,
      {
        product: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        change: delta,
        stockAfter: newStock,
        minimumStock: product.minimumStock,
        wouldBeLowStock: newStock < product.minimumStock,
      }
    )
  }

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: args.type,
        quantity: args.quantity,
        date: new Date(),
        comment: typeof args.comment === 'string' ? args.comment : 'Adjusted via assistant',
        createdBy: ctx.actor.name,
      },
    }),
    prisma.inventoryProduct.update({
      where: { id: product.id },
      data: { currentStock: newStock },
    }),
  ])

  await audit(ctx, 'update', 'inventory_product', product.id, {
    product: product.name,
    movementId: movement.id,
    type: args.type,
    quantity: args.quantity,
    stockAfter: newStock,
  })

  // Same low-stock alert the web app fires, so the assistant pushing stock
  // below the threshold notifies the team rather than silently passing.
  await maybeNotifyLowStock(
    {
      name: product.name,
      sku: product.sku,
      currentStock: newStock,
      minimumStock: product.minimumStock,
      unitOfMeasure: product.unitOfMeasure,
    },
    product.currentStock
  ).catch(() => {})

  return ok({
    adjusted: true,
    product: product.name,
    type: args.type,
    quantity: args.quantity,
    stockBefore: product.currentStock,
    stockAfter: newStock,
    lowStock: newStock < product.minimumStock,
  })
}
