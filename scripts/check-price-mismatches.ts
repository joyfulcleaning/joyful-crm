import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find all invoiced services and compare service.total vs InvoiceItem.total
  const items = await prisma.invoiceItem.findMany({
    where: { serviceId: { not: null } },
    include: {
      service: { select: { serviceNumber: true, total: true, basePrice: true, additionalFee: true, invoicedAt: true } },
      invoice: { select: { invoiceNumber: true, total: true, subtotal: true, additionalFees: true } },
    },
    orderBy: { invoice: { invoiceNumber: 'asc' } },
  })

  const mismatches: any[] = []

  for (const item of items) {
    const svcTotal    = Number(item.service?.total ?? 0)
    const itemTotal   = Number(item.total)
    const diff        = itemTotal - svcTotal
    if (Math.abs(diff) > 0.01) {
      mismatches.push({
        invoice:    item.invoice.invoiceNumber,
        svcNum:     item.service?.serviceNumber,
        svcTotal,
        itemTotal,
        diff,
        basePrice:  Number(item.service?.basePrice ?? 0),
        addFee:     Number(item.service?.additionalFee ?? 0),
        unitPrice:  Number(item.unitPrice),
      })
    }
  }

  if (mismatches.length === 0) {
    console.log('No mismatches found — all InvoiceItem.total values match service.total')
  } else {
    console.log(`\nFound ${mismatches.length} mismatch(es) between service.total and InvoiceItem.total:\n`)
  }
  for (const m of mismatches) {
    console.log(`  Invoice: ${m.invoice}  |  Service #${m.svcNum}`)
    console.log(`    service.total = $${m.svcTotal.toFixed(2)}  (basePrice $${m.basePrice.toFixed(2)} + addFee $${m.addFee.toFixed(2)})`)
    console.log(`    invoiceItem.total = $${m.itemTotal.toFixed(2)}  (unitPrice $${m.unitPrice.toFixed(2)})`)
    console.log(`    diff: ${m.diff > 0 ? '+' : ''}$${m.diff.toFixed(2)}\n`)
  }

  console.log('')

  // Also show invoices where invoice.total != sum(invoiceItems.total)
  console.log('\n── Invoice-level total vs sum(items) ──\n')
  const invoices = await prisma.invoice.findMany({
    include: { items: true },
    orderBy: { invoiceNumber: 'asc' },
  })
  for (const inv of invoices) {
    const sumItems = inv.items.reduce((s, it) => s + Number(it.total), 0)
    const stored   = Number(inv.total)
    const gap      = stored - sumItems
    if (Math.abs(gap) > 0.01) {
      console.log(`  ${inv.invoiceNumber}: stored=$${stored.toFixed(2)}  sum(items)=$${sumItems.toFixed(2)}  gap=${gap > 0 ? '+' : ''}$${gap.toFixed(2)}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
