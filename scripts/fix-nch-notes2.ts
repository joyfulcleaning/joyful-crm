import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const r1 = await prisma.service.updateMany({
    where: { serviceNumber: { in: [6343, 6344, 6345] } },
    data: { internalNotes: 'West End At Fayetteville' },
  })
  const r2 = await prisma.service.updateMany({
    where: { serviceNumber: 6361 },
    data: { internalNotes: 'The One At Fayetteville' },
  })
  console.log('Updated:', r1.count + r2.count, 'services to match casing convention')
}

main().catch(console.error).finally(() => prisma.$disconnect())
