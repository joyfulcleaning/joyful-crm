import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    include: { items: { include: { service: true } } }
  })

  // 1. Items without a service (manual line items)
  console.log('=== INVOICE ITEMS WITHOUT A SERVICE (manual) ===')
  let manualItemsTotal = 0
  for (const inv of invoices) {
    const manualItems = inv.items.filter(it => !it.service)
    if (manualItems.length > 0) {
      for (const it of manualItems) {
        console.log(`  Invoice #${inv.invoiceNumber}: "${it.description}" = $${Number(it.total).toFixed(2)}`)
        manualItemsTotal += Number(it.total)
      }
    }
  }
  console.log(`  TOTAL manual items: $${manualItemsTotal.toFixed(2)}`)

  // 2. Invoices where stored total ≠ subtotal + additionalFees
  console.log('\n=== INVOICES WHERE total ≠ subtotal + additionalFees ===')
  let totalMismatch = 0
  for (const inv of invoices) {
    const expected = Number(inv.subtotal) + Number(inv.additionalFees)
    const actual   = Number(inv.total)
    if (Math.abs(actual - expected) > 0.01) {
      console.log(`  Invoice #${inv.invoiceNumber}: subtotal=$${Number(inv.subtotal).toFixed(2)} + fees=$${Number(inv.additionalFees).toFixed(2)} = $${expected.toFixed(2)}, stored total=$${actual.toFixed(2)}, diff=$${(actual - expected).toFixed(2)}`)
      totalMismatch += (actual - expected)
    }
  }
  console.log(`  Total mismatch: $${totalMismatch.toFixed(2)}`)

  // 3. Invoices where stored subtotal ≠ sum of invoice items
  console.log('\n=== INVOICES WHERE subtotal ≠ sum of items ===')
  let subtotalMismatch = 0
  for (const inv of invoices) {
    const itemsSum = inv.items.reduce((s, it) => s + Number(it.total), 0)
    const stored   = Number(inv.subtotal)
    if (Math.abs(itemsSum - stored) > 0.01) {
      console.log(`  Invoice #${inv.invoiceNumber}: sum(items)=$${itemsSum.toFixed(2)}, stored subtotal=$${stored.toFixed(2)}, diff=$${(itemsSum - stored).toFixed(2)}`)
      subtotalMismatch += (itemsSum - stored)
    }
  }
  console.log(`  Total mismatch: $${subtotalMismatch.toFixed(2)}`)

  // 4. Services with invoicedAt that are NOT in any InvoiceItem
  console.log('\n=== SERVICES WITH invoicedAt BUT NOT IN ANY INVOICE ITEM ===')
  const allItemServiceIds = new Set(invoices.flatMap(inv => inv.items.map(it => it.serviceId)).filter(Boolean))
  const invoicedServices = await prisma.service.findMany({ where: { invoicedAt: { not: null }, status: 'completed' } })
  const orphanedServices = invoicedServices.filter(sv => !allItemServiceIds.has(sv.id))
  for (const sv of orphanedServices) {
    console.log(`  Service #${sv.serviceNumber}: total=$${Number(sv.total).toFixed(2)}, invoicedAt=${sv.invoicedAt}`)
  }
  const orphanedTotal = orphanedServices.reduce((s, sv) => s + Number(sv.total), 0)
  console.log(`  Count: ${orphanedServices.length}, Total: $${orphanedTotal.toFixed(2)}`)

  // 5. Final numbers
  const sumItemsTotal = invoices.flatMap(inv => inv.items).reduce((s, it) => s + Number(it.total), 0)
  const sumAdditionalFees = invoices.reduce((s, inv) => s + Number(inv.additionalFees), 0)
  const sumInvoiceTotal = invoices.reduce((s, inv) => s + Number(inv.total), 0)
  const sumServiceItemsTotal = invoices.flatMap(inv => inv.items).filter(it => it.service).reduce((s, it) => s + Number(it.total), 0)
  const invoicedServicesTotal = invoicedServices.reduce((s, sv) => s + Number(sv.total), 0)

  console.log('\n=== FINAL RECONCILIATION ===')
  console.log(`sum(invoice.total):           $${sumInvoiceTotal.toFixed(2)}`)
  console.log(`sum(invoiceItem.total):        $${sumItemsTotal.toFixed(2)}`)
  console.log(`  - items WITH service:        $${sumServiceItemsTotal.toFixed(2)}`)
  console.log(`  - items WITHOUT service:     $${(sumItemsTotal - sumServiceItemsTotal).toFixed(2)}`)
  console.log(`sum(invoice.additionalFees):   $${sumAdditionalFees.toFixed(2)}`)
  console.log(`invoicedServicesTotal:         $${invoicedServicesTotal.toFixed(2)}`)
  console.log(`orphaned services total:       $${orphanedTotal.toFixed(2)}`)
  console.log()
  console.log(`invoicedServicesTotal ($${invoicedServicesTotal.toFixed(2)}) = items-with-service ($${sumServiceItemsTotal.toFixed(2)}) + orphaned ($${orphanedTotal.toFixed(2)})`)
  console.log(`Check: $${(sumServiceItemsTotal + orphanedTotal).toFixed(2)}`)
  console.log()
  console.log(`sum(invoice.total) ($${sumInvoiceTotal.toFixed(2)}) = items ($${sumItemsTotal.toFixed(2)}) + additionalFees ($${sumAdditionalFees.toFixed(2)})`)
  console.log(`Check: $${(sumItemsTotal + sumAdditionalFees).toFixed(2)}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
