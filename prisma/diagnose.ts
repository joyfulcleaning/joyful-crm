import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Total completed services
  const completed = await prisma.service.findMany({
    where: { status: 'completed' },
    select: { id: true, total: true, invoicedAt: true },
  })
  const totalCompleted = completed.reduce((s, r) => s + Number(r.total), 0)
  const withInvoicedAt = completed.filter(s => s.invoicedAt !== null)
  console.log(`\n✅ Completed services:         ${completed.length}  →  $${totalCompleted.toFixed(2)}`)
  console.log(`   → With invoicedAt set:       ${withInvoicedAt.length}`)
  console.log(`   → Without invoicedAt (null): ${completed.length - withInvoicedAt.length}`)

  // How many completed services appear in any invoice item?
  const inInvoice = await prisma.invoiceItem.findMany({
    where: { service: { status: 'completed' } },
    select: { serviceId: true, unitPrice: true, total: true },
  })
  const serviceIdsInInvoice = new Set(inInvoice.map(i => i.serviceId))
  const totalInvoiceItemAmount = inInvoice.reduce((s, r) => s + Number(r.total), 0)
  console.log(`\n📋 Completed services linked to an invoice item: ${serviceIdsInInvoice.size}  →  $${totalInvoiceItemAmount.toFixed(2)}`)

  // Completed services NOT in any invoice
  const notInInvoice = completed.filter(s => !serviceIdsInInvoice.has(s.id))
  const totalNotInvoiced = notInInvoice.reduce((s, r) => s + Number(r.total), 0)
  console.log(`   Completed services NOT in any invoice:        ${notInInvoice.length}  →  $${totalNotInvoiced.toFixed(2)}`)

  // Total of all invoices
  const invoices = await prisma.invoice.aggregate({ _sum: { total: true }, _count: true })
  console.log(`\n📄 Invoices total:  ${invoices._count} invoices  →  $${Number(invoices._sum.total || 0).toFixed(2)}`)

  console.log(`\n📊 Difference breakdown:`)
  console.log(`   Completed services total:         $${totalCompleted.toFixed(2)}`)
  console.log(`   Billed via invoice items:        -$${totalInvoiceItemAmount.toFixed(2)}`)
  console.log(`   NOT billed yet:                   $${totalNotInvoiced.toFixed(2)}`)
  console.log(`   Invoice vs billed-services diff:  $${(Number(invoices._sum.total || 0) - totalInvoiceItemAmount).toFixed(2)}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
