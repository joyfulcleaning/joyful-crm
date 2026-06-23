import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.service.findMany({
    where: { OR: [
      { internalNotes: { contains: 'reno', mode: 'insensitive' } },
      { staffNotes: { contains: 'reno', mode: 'insensitive' } },
      { unit: { contains: 'reno', mode: 'insensitive' } },
    ] },
    select: { serviceNumber: true, type: true, unit: true, roomSize: true, internalNotes: true, staffNotes: true, basePrice: true, additionalFee: true },
    take: 20,
  })
  console.log(rows)
}
main().catch(console.error).finally(() => prisma.$disconnect())
