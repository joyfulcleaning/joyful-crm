import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.service.findMany({
    where: { OR: [{ roomSize: { contains: '1x1', mode: 'insensitive' } }, { roomSize: { contains: '3x2', mode: 'insensitive' } }, { roomSize: { contains: '2 BR', mode: 'insensitive' } }] },
    select: { roomSize: true, basePrice: true, unit: true, client: { select: { name: true } } },
  })
  console.log(rows)
}
main().catch(console.error).finally(() => prisma.$disconnect())
