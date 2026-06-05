import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CUTOFF = new Date('2026-05-01')

async function main() {
  console.log('🧹 Cleanup: deleting records on or after 2026-05-01...\n')

  // 1. PayrollRecords after cutoff — collect linked expenseIds first
  const payrollToDelete = await prisma.payrollRecord.findMany({
    where: { payDate: { gte: CUTOFF } },
    select: { id: true, expenseId: true },
  })
  const payrollIds  = payrollToDelete.map(r => r.id)
  const expenseIdsFromPayroll = payrollToDelete.map(r => r.expenseId).filter(Boolean) as string[]
  console.log(`PayrollRecords to delete: ${payrollIds.length}`)

  if (payrollIds.length > 0) {
    await prisma.payrollRecord.deleteMany({ where: { id: { in: payrollIds } } })
    console.log(`  ✓ Deleted ${payrollIds.length} payroll records`)
  }

  // 2. Invoices after cutoff (cascade → InvoiceItem, InvoicePayment)
  const invoicesDel = await prisma.invoice.deleteMany({
    where: { issuedAt: { gte: CUTOFF } },
  })
  console.log(`  ✓ Deleted ${invoicesDel.count} invoices (+ items & payments via cascade)`)

  // 3. Null out InvoiceItem.serviceId for remaining items pointing at services to be deleted
  //    (in case any pre-cutoff invoice had a post-cutoff service item — safety step)
  const servicesToDelete = await prisma.service.findMany({
    where: { serviceDate: { gte: CUTOFF } },
    select: { id: true },
  })
  const serviceIds = servicesToDelete.map(s => s.id)
  if (serviceIds.length > 0) {
    const updated = await prisma.invoiceItem.updateMany({
      where: { serviceId: { in: serviceIds } },
      data:  { serviceId: null },
    })
    if (updated.count > 0) console.log(`  ✓ Nulled serviceId on ${updated.count} orphaned invoice items`)

    // 4. Delete Services (cascade → ServiceStaff, ServicePhoto)
    const svcDel = await prisma.service.deleteMany({
      where: { id: { in: serviceIds } },
    })
    console.log(`  ✓ Deleted ${svcDel.count} services (+ staff assignments & photos via cascade)`)
  } else {
    console.log(`  ✓ No services to delete`)
  }

  // 5. Delete Expenses after cutoff (includes payroll-linked ones now freed)
  const expDel = await prisma.expense.deleteMany({
    where: { expenseDate: { gte: CUTOFF } },
  })
  console.log(`  ✓ Deleted ${expDel.count} expenses`)

  // Also delete any payroll-linked expenses not caught by date (edge case)
  if (expenseIdsFromPayroll.length > 0) {
    const extra = await prisma.expense.deleteMany({
      where: { id: { in: expenseIdsFromPayroll } },
    })
    if (extra.count > 0) console.log(`  ✓ Deleted ${extra.count} additional payroll-linked expenses`)
  }

  console.log('\n✅ Cleanup complete.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
