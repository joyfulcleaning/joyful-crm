import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Fix invoices with period 01/02/2026 – 01/16/2026 → issuedAt = 01/17/2026
  const result = await prisma.invoice.updateMany({
    where: {
      periodFrom: new Date('2026-01-02'),
      periodTo:   new Date('2026-01-16'),
    },
    data: {
      issuedAt: new Date('2026-01-17T12:00:00.000Z'),
    },
  })
  console.log(`Updated ${result.count} invoice(s) to issuedAt = 2026-01-17`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
