import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    include: { items: { include: { service: true } } },
    orderBy: { invoiceNumber: 'asc' }
  })

  // Find invoices where stored total ≠ sum of their items
  console.log('=== INVOICES WHERE stored total ≠ sum(items) ===')
  let totalExcess = 0
  for (const inv of invoices) {
    const itemsSum = inv.items.reduce((s, it) => s + Number(it.total), 0)
    const storedTotal = Number(inv.total)
    const diff = storedTotal - itemsSum
    if (Math.abs(diff) > 0.01) {
      console.log(`  Invoice #${inv.invoiceNumber}: sum(items)=$${itemsSum.toFixed(2)}, stored total=$${storedTotal.toFixed(2)}, excess=$${diff.toFixed(2)}`)
      totalExcess += diff
    }
  }
  console.log(`  TOTAL excess in invoice.total over items: $${totalExcess.toFixed(2)}`)

  // Also check Invoice #527 specifically
  const inv527 = invoices.find(i => i.invoiceNumber === '527')
  if (inv527) {
    console.log(`\n=== INVOICE #527 DETAIL ===`)
    console.log(`  stored: subtotal=$${Number(inv527.subtotal)}, additionalFees=$${Number(inv527.additionalFees)}, total=$${Number(inv527.total)}`)
    const itemsSum = inv527.items.reduce((s, it) => s + Number(it.total), 0)
    console.log(`  sum(items)=$${itemsSum.toFixed(2)}`)
    for (const it of inv527.items) {
      console.log(`    item: ${it.description}, total=$${Number(it.total).toFixed(2)}, svcTotal=${it.service ? '$'+Number(it.service.total).toFixed(2) : 'no svc'}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
