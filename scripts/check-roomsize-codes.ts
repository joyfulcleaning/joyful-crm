import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.service.findMany({
    where: { roomSize: { in: ['1x1','2x2','3x2','2x1','Modelo'] } },
    select: { roomSize: true, basePrice: true, unit: true, client: { select: { name: true } } },
    take: 40,
    orderBy: { serviceDate: 'desc' },
  })
  for (const r of rows) console.log(r.client.name, r.unit, r.roomSize, '$'+r.basePrice)
}
main().catch(console.error).finally(() => prisma.$disconnect())
