import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. JOYFUL062 detail
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'JOYFUL062' },
    include: { items: { include: { service: true } } }
  })
  if (!inv) { console.log('Invoice JOYFUL062 not found'); return }

  console.log('=== INVOICE JOYFUL062 ===')
  console.log(`  stored: subtotal=$${Number(inv.subtotal)}, additionalFees=$${Number(inv.additionalFees)}, total=$${Number(inv.total)}`)
  const itemsSum = inv.items.reduce((s, it) => s + Number(it.total), 0)
  console.log(`  sum(items): $${itemsSum.toFixed(2)}`)
  console.log(`  excess (total - items): $${(Number(inv.total) - itemsSum).toFixed(2)}`)
  console.log('\n  Items:')
  for (const it of inv.items) {
    const svc = it.service
    console.log(`    #${svc?.serviceNumber ?? 'no-svc'} | ${it.description} | item.total=$${Number(it.total).toFixed(2)} | svc.total=${svc ? '$'+Number(svc.total).toFixed(2) : 'N/A'} | svc.basePrice=${svc ? '$'+Number(svc.basePrice).toFixed(2) : 'N/A'} | svc.additionalFee=${svc ? '$'+Number(svc.additionalFee).toFixed(2) : 'N/A'}`)
  }

  // 2. Uninvoiced services with duplicate serviceNumbers
  console.log('\n=== UNINVOICED SERVICES WITH DUPLICATE serviceNumbers ===')
  const uninvoiced = await prisma.service.findMany({
    where: { invoicedAt: null },
    select: { id: true, serviceNumber: true, serviceDate: true, status: true, total: true, client: { select: { name: true } } },
    orderBy: { serviceNumber: 'asc' }
  })

  // Find which serviceNumbers are duplicated in the full DB
  const allServices = await prisma.service.findMany({
    select: { serviceNumber: true },
    orderBy: { serviceNumber: 'asc' }
  })
  const duplicatedNums = new Set<number>()
  const counts = new Map<number, number>()
  for (const s of allServices) {
    counts.set(s.serviceNumber, (counts.get(s.serviceNumber) ?? 0) + 1)
  }
  for (const [num, cnt] of counts) {
    if (cnt > 1) duplicatedNums.add(num)
  }

  const uninvoicedDupes = uninvoiced.filter(s => duplicatedNums.has(s.serviceNumber))
  console.log(`  Uninvoiced services with a duplicate serviceNumber: ${uninvoicedDupes.length}`)
  for (const s of uninvoicedDupes) {
    console.log(`    #${s.serviceNumber} | ${s.serviceDate?.toISOString().split('T')[0]} | ${s.status} | $${Number(s.total).toFixed(2)} | ${s.client?.name}`)
  }

  const safe = uninvoicedDupes.filter(s => s.status !== 'cancelled')
  console.log(`\n  Safe to renumber (not cancelled): ${safe.length}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
