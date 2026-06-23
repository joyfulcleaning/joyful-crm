import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r1 = await prisma.invoice.update({ where: { invoiceNumber: 'SP-001-2026' }, data: { invoiceNumber: '18' } })
  const r2 = await prisma.invoice.update({ where: { invoiceNumber: 'W-001-2026'  }, data: { invoiceNumber: '533' } })
  console.log('SP-001-2026 →', r1.invoiceNumber)
  console.log('W-001-2026  →', r2.invoiceNumber)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
