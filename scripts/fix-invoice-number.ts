import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r = await prisma.invoice.update({
    where: { invoiceNumber: 'JOYFUL0778' },
    data:  { invoiceNumber: 'JOYFUL078' },
  })
  console.log('Updated:', r.invoiceNumber)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
