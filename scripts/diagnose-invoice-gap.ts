import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Sum of invoice.total for all invoices
  const invoices = await prisma.invoice.findMany({
    include: { items: { include: { service: true } } }
  })

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0)
  const totalAdditionalFees = invoices.reduce((s, i) => s + Number(i.additionalFees || 0), 0)
  const totalSubtotal = invoices.reduce((s, i) => s + Number(i.subtotal || 0), 0)

  console.log('\n=== INVOICE TOTALS ===')
  console.log(`Sum of invoice.total:        $${totalInvoiced.toFixed(2)}`)
  console.log(`Sum of invoice.subtotal:     $${totalSubtotal.toFixed(2)}`)
  console.log(`Sum of invoice.additionalFees: $${totalAdditionalFees.toFixed(2)}`)

  // 2. Invoices with additionalFees
  const withFees = invoices.filter(i => Number(i.additionalFees) !== 0)
  console.log(`\n=== INVOICES WITH additionalFees (${withFees.length}) ===`)
  for (const inv of withFees) {
    console.log(`  Invoice #${inv.invoiceNumber}: subtotal=$${Number(inv.subtotal).toFixed(2)}, additionalFees=$${Number(inv.additionalFees).toFixed(2)}, total=$${Number(inv.total).toFixed(2)}`)
  }

  // 3. Completed services
  const completedServices = await prisma.service.findMany({
    where: { status: 'completed' }
  })
  const completedTotal = completedServices.reduce((s, sv) => s + Number(sv.total), 0)
  const notInvoicedCompleted = completedServices.filter(sv => !sv.invoicedAt).reduce((s, sv) => s + Number(sv.total), 0)
  const invoicedServicesTotal = completedTotal - notInvoicedCompleted

  console.log('\n=== SERVICE TOTALS ===')
  console.log(`completedTotal:          $${completedTotal.toFixed(2)}`)
  console.log(`invoicedServicesTotal:   $${invoicedServicesTotal.toFixed(2)}  (service.total where invoicedAt IS NOT NULL)`)
  console.log(`notInvoicedCompleted:    $${notInvoicedCompleted.toFixed(2)}`)

  // 4. Gap analysis
  const gapA = notInvoicedCompleted       // "Not Invoiced" card
  const gapB = completedTotal - totalInvoiced  // "Completed vs Invoiced" card
  console.log('\n=== GAP ANALYSIS ===')
  console.log(`"Not Invoiced" card:           $${gapA.toFixed(2)}`)
  console.log(`"Completed vs Invoiced" card:  $${gapB.toFixed(2)}`)
  console.log(`Difference between cards:      $${(gapA - gapB).toFixed(2)}`)
  console.log(`\nExpected: additionalFees ($${totalAdditionalFees.toFixed(2)}) + price snapshot diffs`)

  // 5. InvoiceItem vs current service.total differences
  console.log('\n=== INVOICE ITEM SNAPSHOT vs CURRENT SERVICE.TOTAL ===')
  let totalSnapshotDiff = 0
  for (const inv of invoices) {
    for (const item of inv.items) {
      if (!item.service) continue
      const itemTotal = Number(item.total)
      const svcTotal = Number(item.service.total)
      const diff = itemTotal - svcTotal
      if (Math.abs(diff) > 0.01) {
        console.log(`  Invoice #${inv.invoiceNumber} / Service #${item.service.serviceNumber}: item.total=$${itemTotal.toFixed(2)}, service.total=$${svcTotal.toFixed(2)}, diff=$${diff.toFixed(2)}`)
        totalSnapshotDiff += diff
      }
    }
  }
  console.log(`  Total snapshot diffs: $${totalSnapshotDiff.toFixed(2)}`)

  // 6. Services with invoicedAt but status != completed
  const invoicedNotCompleted = await prisma.service.findMany({
    where: { invoicedAt: { not: null }, status: { not: 'completed' } }
  })
  console.log(`\n=== SERVICES WITH invoicedAt BUT NOT completed (${invoicedNotCompleted.length}) ===`)
  for (const sv of invoicedNotCompleted) {
    console.log(`  Service #${sv.serviceNumber}: status=${sv.status}, total=$${Number(sv.total).toFixed(2)}`)
  }

  const invoicedNotCompletedTotal = invoicedNotCompleted.reduce((s, sv) => s + Number(sv.total), 0)
  if (invoicedNotCompletedTotal > 0) {
    console.log(`  Total: $${invoicedNotCompletedTotal.toFixed(2)}`)
  }

  console.log('\n=== RECONCILIATION ===')
  console.log(`totalInvoiced ($${totalInvoiced.toFixed(2)}) should = invoicedServicesTotal ($${invoicedServicesTotal.toFixed(2)}) + additionalFees ($${totalAdditionalFees.toFixed(2)}) + snapshotDiffs ($${totalSnapshotDiff.toFixed(2)})`)
  console.log(`Check: $${(invoicedServicesTotal + totalAdditionalFees + totalSnapshotDiff).toFixed(2)}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
