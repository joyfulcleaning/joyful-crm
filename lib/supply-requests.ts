import { prisma } from '@/lib/prisma'
import { notifyEvent } from '@/lib/notify-admin'
import { sendPushToUsers, pendingRequestCount, REQUEST_SOUND, REQUEST_THREAD } from '@/lib/push'
import { maybeNotifyLowStock } from '@/lib/low-stock'
import type { AuthUser } from '@/lib/mobile-auth'

// Staff ask for products that are already in stock; the admin dispatches the
// request and the delivered amounts come straight out of inventory. The
// delivered quantity is deliberately separate from the requested one: if
// someone asks for 3 and only 2 are left, the admin hands over 2 and the
// request still closes with an honest record of both numbers.

// Short, readable handle for a request — the id is a uuid, which is useless
// to read out loud. Mirrors the same helper in the AI requests screen.
export function shortCode(id: string): string {
  return (id || '').replace(/-/g, '').slice(-4).toUpperCase()
}

const REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true, avatarInitials: true } },
  resolvedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: { id: true, name: true, sku: true, category: true, unitOfMeasure: true, currentStock: true, minimumStock: true },
      },
    },
  },
} as const

type RawRequest = Awaited<ReturnType<typeof loadRequest>>

async function loadRequest(id: string) {
  return prisma.supplyRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE })
}

/**
 * The shape both the web page and the mobile screens render. Everything the UI
 * needs to decide what to show is computed here — `code`, whether a fulfilled
 * request came up short, and the per-line stock available right now — so no
 * client has to re-derive it (and get it subtly different).
 */
export function serializeRequest(r: NonNullable<RawRequest>) {
  const items = r.items.map(i => ({
    id: i.id,
    productId: i.productId,
    name: i.product.name,
    sku: i.product.sku,
    category: i.product.category,
    unitOfMeasure: i.product.unitOfMeasure,
    currentStock: i.product.currentStock,
    requestedQty: i.requestedQty,
    deliveredQty: i.deliveredQty,
    movementId: i.movementId,
  }))

  const totalRequested = items.reduce((sum, i) => sum + i.requestedQty, 0)
  const totalDelivered = items.reduce((sum, i) => sum + (i.deliveredQty ?? 0), 0)

  return {
    id: r.id,
    code: shortCode(r.id),
    status: r.status,
    note: r.note,
    adminNote: r.adminNote,
    neededBy: r.neededBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    resolvedAt: r.resolvedAt,
    requestedBy: r.requestedBy,
    resolvedBy: r.resolvedBy,
    items,
    totalRequested,
    totalDelivered,
    // A fulfilled request where something got cut — the staff member needs to
    // see that at a glance instead of assuming they got everything.
    partial: r.status === 'fulfilled' && totalDelivered < totalRequested,
  }
}

export type SerializedSupplyRequest = ReturnType<typeof serializeRequest>

export async function listSupplyRequests(authUser: AuthUser): Promise<SerializedSupplyRequest[]> {
  const requests = await prisma.supplyRequest.findMany({
    // Staff only ever see their own; the admin sees the whole queue.
    where: authUser.role === 'admin' ? undefined : { requestedById: authUser.id },
    include: REQUEST_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
  })
  return requests.map(serializeRequest)
}

// ── Create ──────────────────────────────────────────────────────────────────

export type CreateItemInput = { productId?: unknown; quantity?: unknown }

function parseQty(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function createSupplyRequest(
  authUser: AuthUser,
  body: { items?: unknown; note?: unknown; neededBy?: unknown },
): Promise<{ status: number; body: any }> {
  const rawItems = Array.isArray(body.items) ? (body.items as CreateItemInput[]) : []
  if (rawItems.length === 0) {
    return { status: 400, body: { error: 'Add at least one product to the request' } }
  }

  // Collapse duplicates instead of rejecting them: the mobile cart can't
  // produce two lines for one product, but a retry or an older build might.
  const wanted = new Map<string, number>()
  for (const item of rawItems) {
    const productId = typeof item?.productId === 'string' ? item.productId : ''
    const quantity = parseQty(item?.quantity)
    if (!productId || quantity === null) {
      return { status: 400, body: { error: 'Every line needs a product and a whole quantity above zero' } }
    }
    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity)
  }

  const products = await prisma.inventoryProduct.findMany({
    where: { id: { in: [...wanted.keys()] } },
    select: { id: true, name: true, unitOfMeasure: true },
  })
  if (products.length !== wanted.size) {
    return { status: 404, body: { error: 'One of the products no longer exists' } }
  }

  const neededByStr = typeof body.neededBy === 'string' ? body.neededBy.trim() : ''
  if (neededByStr && !/^\d{4}-\d{2}-\d{2}$/.test(neededByStr)) {
    return { status: 400, body: { error: 'Invalid date' } }
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''

  const created = await prisma.supplyRequest.create({
    data: {
      requestedById: authUser.id,
      note: note || null,
      // Noon keeps the stored date on the intended day regardless of timezone.
      neededBy: neededByStr ? new Date(`${neededByStr}T12:00:00`) : null,
      items: {
        create: [...wanted.entries()].map(([productId, requestedQty]) => ({ productId, requestedQty })),
      },
    },
    include: REQUEST_INCLUDE,
  })

  await notifyAdminOfSupplyRequest(created, authUser.name).catch(err =>
    console.error('Error notifying admin of supply request:', err)
  )

  return { status: 201, body: serializeRequest(created) }
}

function itemLines(r: NonNullable<RawRequest>): string {
  return r.items
    .map(i => `${i.requestedQty} ${i.product.unitOfMeasure} — ${i.product.name}`)
    .join('\n')
}

async function notifyAdminOfSupplyRequest(r: NonNullable<RawRequest>, staffName: string) {
  const lines = itemLines(r)
  const count = r.items.length
  await notifyEvent('supplyRequest', {
    pushTitle: `📦 ${staffName} needs supplies`,
    pushBody: count === 1 ? lines : `${count} products · ${lines.split('\n')[0]}…`,
    pushData: { type: 'supplyRequest', requestId: r.id },
    // Same chime, thread and badge as the caller/website review queue — it's
    // the same inbox from the admin's point of view.
    pushOptions: { sound: REQUEST_SOUND, threadId: REQUEST_THREAD, badge: await pendingRequestCount() },
    emailSubject: `📦 Supply request from ${staffName} (#${shortCode(r.id)})`,
    emailHtml: `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#4A3FB0;margin-bottom:4px">📦 Supply request</h2>
        <p style="font-size:14px;color:#333"><strong>${staffName}</strong> is asking for products from stock.</p>
        <table style="font-size:14px;color:#333;border-collapse:collapse">
          ${r.items.map(i => `
            <tr>
              <td style="padding:4px 12px 4px 0"><strong>${i.requestedQty} ${i.product.unitOfMeasure}</strong></td>
              <td style="padding:4px 0">${i.product.name} <span style="color:#888">(${i.product.sku})</span></td>
              <td style="padding:4px 0 4px 12px;color:#888">${i.product.currentStock} in stock</td>
            </tr>`).join('')}
        </table>
        ${r.note ? `<p style="font-size:13px;color:#555"><strong>Note:</strong> ${r.note}</p>` : ''}
        <p style="font-size:13px;color:#666">
          <a href="https://joyful-crm.vercel.app/ai-requests">Dispatch it in the CRM</a>
        </p>
      </div>
    `,
  })
}

// ── Resolve (admin) ─────────────────────────────────────────────────────────

export type FulfillLine = { itemId?: unknown; deliveredQty?: unknown }

// Aborts the dispatch transaction when a product ran out between the admin
// opening the request and hitting dispatch. Carries the live number so the
// response can tell them exactly what's left.
class InsufficientStockError extends Error {
  constructor(readonly productName: string, readonly available: number, readonly wanted: number) {
    super('INSUFFICIENT_STOCK')
  }
}

/**
 * Hands over the request. `lines` carries the quantity the admin is actually
 * delivering per line — defaults to the requested amount for any line left
 * out. Every delivery is deducted from stock and recorded as an InventoryMovement.
 *
 * The whole dispatch is one transaction with a conditional UPDATE per line, so
 * a product someone else drained in the meantime fails the entire operation
 * instead of leaving the request half-dispatched. The admin then sees the real
 * number and can adjust.
 */
export async function fulfillSupplyRequest(
  id: string,
  authUser: AuthUser,
  body: { lines?: unknown; adminNote?: unknown },
): Promise<{ status: number; body: any }> {
  const existing = await loadRequest(id)
  if (!existing) return { status: 404, body: { error: 'Request not found' } }
  if (existing.status !== 'pending') {
    return { status: 409, body: { error: 'This request was already resolved' } }
  }

  const byItemId = new Map<string, number>()
  if (Array.isArray(body.lines)) {
    for (const line of body.lines as FulfillLine[]) {
      const itemId = typeof line?.itemId === 'string' ? line.itemId : ''
      if (!itemId) continue
      const n = typeof line.deliveredQty === 'number' ? line.deliveredQty : parseInt(String(line.deliveredQty ?? ''), 10)
      if (!Number.isInteger(n) || n < 0) {
        return { status: 400, body: { error: 'Delivered quantities must be whole numbers of zero or more' } }
      }
      byItemId.set(itemId, n)
    }
  }

  const plan = existing.items.map(item => ({
    item,
    // An omitted line means "give them what they asked for".
    deliveredQty: byItemId.has(item.id) ? byItemId.get(item.id)! : item.requestedQty,
  }))

  for (const { item, deliveredQty } of plan) {
    if (deliveredQty > item.requestedQty) {
      return {
        status: 400,
        body: { error: `You can't deliver more ${item.product.name} than the ${item.requestedQty} that were requested` },
      }
    }
  }

  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : ''
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // Stock levels before the deduction, needed for the low-stock crossing check
  // after the transaction commits.
  const previousStock = new Map(plan.map(p => [p.item.productId, p.item.product.currentStock]))

  try {
    const updated = await prisma.$transaction(async tx => {
      for (const { item, deliveredQty } of plan) {
        if (deliveredQty === 0) {
          await tx.supplyRequestItem.update({ where: { id: item.id }, data: { deliveredQty: 0 } })
          continue
        }

        // Same atomic guard as /api/inventory/movements: the conditional WHERE
        // is what keeps stock from going negative under concurrent dispatches.
        const rows = await tx.$queryRawUnsafe<{ currentStock: number }[]>(
          `UPDATE inventory_products
           SET "currentStock" = "currentStock" - $1, "updatedAt" = NOW()
           WHERE id = $2 AND "currentStock" >= $1
           RETURNING "currentStock"`,
          deliveredQty, item.productId
        )
        if (rows.length === 0) {
          const fresh = await tx.inventoryProduct.findUnique({
            where: { id: item.productId },
            select: { currentStock: true },
          })
          throw new InsufficientStockError(item.product.name, fresh?.currentStock ?? 0, deliveredQty)
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'out',
            quantity: deliveredQty,
            date: new Date(`${dateStr}T12:00:00`),
            comment: `Dispatched to ${existing.requestedBy.name} · request #${shortCode(existing.id)}`,
            createdBy: authUser.name,
          },
        })

        await tx.supplyRequestItem.update({
          where: { id: item.id },
          data: { deliveredQty, movementId: movement.id },
        })
      }

      return tx.supplyRequest.update({
        where: { id },
        data: {
          status: 'fulfilled',
          adminNote: adminNote || null,
          resolvedAt: new Date(),
          resolvedById: authUser.id,
        },
        include: REQUEST_INCLUDE,
      })
    })

    await notifyStaffOfResolution(updated).catch(err =>
      console.error('Error notifying staff of dispatched supply request:', err)
    )

    // Low-stock alerts are per product and only fire on the crossing, so they
    // run after the commit — a failed dispatch must not warn about stock that
    // was never deducted.
    for (const item of updated.items) {
      const before = previousStock.get(item.productId)
      if (before == null || !item.deliveredQty) continue
      await maybeNotifyLowStock(item.product, before).catch(() => {})
    }

    return { status: 200, body: serializeRequest(updated) }
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        status: 409,
        body: {
          error: `Not enough ${err.productName} left — only ${err.available} available, you tried to deliver ${err.wanted}. Adjust the quantity and try again.`,
          productName: err.productName,
          available: err.available,
        },
      }
    }
    throw err
  }
}

export async function rejectSupplyRequest(
  id: string,
  authUser: AuthUser,
  body: { adminNote?: unknown },
): Promise<{ status: number; body: any }> {
  const existing = await loadRequest(id)
  if (!existing) return { status: 404, body: { error: 'Request not found' } }
  if (existing.status !== 'pending') {
    return { status: 409, body: { error: 'This request was already resolved' } }
  }

  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : ''
  const updated = await prisma.supplyRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      adminNote: adminNote || null,
      resolvedAt: new Date(),
      resolvedById: authUser.id,
      // Nothing was handed over — say so on every line rather than leaving
      // them null, which the UI reads as "still undecided".
      items: { updateMany: { where: { requestId: id }, data: { deliveredQty: 0 } } },
    },
    include: REQUEST_INCLUDE,
  })

  await notifyStaffOfResolution(updated).catch(err =>
    console.error('Error notifying staff of rejected supply request:', err)
  )

  return { status: 200, body: serializeRequest(updated) }
}

/** Staff pulling back their own request before anyone acted on it. */
export async function cancelSupplyRequest(
  id: string,
  authUser: AuthUser,
): Promise<{ status: number; body: any }> {
  const existing = await loadRequest(id)
  if (!existing) return { status: 404, body: { error: 'Request not found' } }
  if (authUser.role !== 'admin' && existing.requestedById !== authUser.id) {
    return { status: 403, body: { error: 'This is not your request' } }
  }
  if (existing.status !== 'pending') {
    return { status: 409, body: { error: 'This request was already resolved' } }
  }

  const updated = await prisma.supplyRequest.update({
    where: { id },
    data: { status: 'cancelled', resolvedAt: new Date(), resolvedById: authUser.id },
    include: REQUEST_INCLUDE,
  })
  return { status: 200, body: serializeRequest(updated) }
}

async function notifyStaffOfResolution(r: NonNullable<RawRequest>) {
  const delivered = r.items.filter(i => (i.deliveredQty ?? 0) > 0)
  const cut = r.items.filter(i => (i.deliveredQty ?? 0) < i.requestedQty)

  const title = r.status === 'rejected'
    ? '📦 Supply request declined'
    : cut.length > 0
      ? '📦 Supplies ready (adjusted)'
      : '📦 Your supplies are ready'

  const body = r.status === 'rejected'
    ? (r.adminNote || 'Open the app to see the details.')
    : delivered.length > 0
      ? delivered.map(i => `${i.deliveredQty} ${i.product.unitOfMeasure} ${i.product.name}`).join(', ')
      : 'Nothing could be handed over this time.'

  await sendPushToUsers(
    'supplyRequestResolved',
    [r.requestedById],
    title,
    body,
    { type: 'supplyRequestResolved', requestId: r.id },
    { sound: REQUEST_SOUND, threadId: REQUEST_THREAD },
  )
}

/** Open supply requests, for the inbox badge alongside the AI/quote queue. */
export async function pendingSupplyRequestCount(): Promise<number> {
  try {
    return await prisma.supplyRequest.count({ where: { status: 'pending' } })
  } catch {
    return 0
  }
}
