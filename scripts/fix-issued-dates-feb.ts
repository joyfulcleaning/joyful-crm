import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const r1 = await prisma.invoice.updateMany({
    where: { periodFrom: new Date('2026-01-19'), periodTo: new Date('2026-01-31') },
    data:  { issuedAt: new Date('2026-02-02T12:00:00.000Z') },
  })
  const r2 = await prisma.invoice.updateMany({
    where: { periodFrom: new Date('2026-01-01'), periodTo: new Date('2026-01-31') },
    data:  { issuedAt: new Date('2026-02-02T12:00:00.000Z') },
  })
  console.log(`Period 01/19-01/31: ${r1.count} updated`)
  console.log(`Period 01/01-01/31: ${r2.count} updated`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
