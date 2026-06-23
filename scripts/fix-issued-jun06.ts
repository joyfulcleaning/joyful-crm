import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const r = await prisma.invoice.updateMany({
    where: {
      issuedAt: { gte: new Date('2026-06-06T00:00:00Z'), lt: new Date('2026-06-07T00:00:00Z') }
    },
    data: { issuedAt: new Date('2026-05-31T12:00:00.000Z') },
  })
  console.log(`Updated ${r.count} invoice(s) from 06/06/2026 → 05/31/2026`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
