import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find all services that appear in at least one invoice item but have invoicedAt = null
  const items = await prisma.invoiceItem.findMany({
    where: { serviceId: { not: null } },
    select: { serviceId: true, invoice: { select: { issuedAt: true } } },
  })

  // Group: pick the earliest invoice date per service
  const map = new Map<string, Date>()
  for (const item of items) {
    if (!item.serviceId) continue
    const d = item.invoice.issuedAt
    const existing = map.get(item.serviceId)
    if (!existing || d < existing) map.set(item.serviceId, d)
  }

  const ids = Array.from(map.keys())
  console.log(`Backfilling invoicedAt on ${ids.length} services…`)

  // Update each service with the date of its earliest invoice
  let count = 0
  for (const [id, date] of map.entries()) {
    await prisma.service.update({ where: { id }, data: { invoicedAt: date } })
    count++
  }
  console.log(`✅ Done — ${count} services updated.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
