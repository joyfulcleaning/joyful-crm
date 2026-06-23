import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const c = await prisma.client.findFirst({
    where: { name: { contains: 'Jamestown', mode: 'insensitive' } },
    include: { management: true },
  })
  console.log(JSON.stringify(c, null, 2))

  // 114 3BR DC precedent - any 3BR DC anywhere?
  const dc3br = await prisma.service.findMany({
    where: { clientId: c?.id, roomSize: '3BR', type: 'Deep Clean' },
    select: { serviceNumber: true, serviceDate: true, unit: true, basePrice: true, total: true },
  })
  console.log('\n3BR Deep Clean precedents at Jamestown:', JSON.stringify(dc3br))
}

main().catch(console.error).finally(() => prisma.$disconnect())
