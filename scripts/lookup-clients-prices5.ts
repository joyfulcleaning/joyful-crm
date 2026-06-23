import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const dc = await prisma.service.findMany({
    where: { unit: { contains: 'DC', mode: 'insensitive' } },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, internalNotes: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('--- "DC" units ---')
  for (const s of dc) console.log(JSON.stringify(s))

  const u1110 = await prisma.service.findMany({
    where: { unit: { startsWith: '1110' } },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- "1110-*" units ---')
  for (const s of u1110) console.log(JSON.stringify(s))
}

main().catch(console.error).finally(() => prisma.$disconnect())
