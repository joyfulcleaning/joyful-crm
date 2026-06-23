import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clients = [
    { name: 'Susie Cleaning', id: '8b76dff3-60ba-47a5-9d3f-1228abf8134d' },
    { name: 'Annette Cleaning', id: '3f20fd48-bdc5-440e-a616-86ac991255f3' },
  ]

  for (const c of clients) {
    const last = await prisma.service.findFirst({
      where: { clientId: c.id, status: { not: 'cancelled' } },
      orderBy: { serviceDate: 'desc' },
      select: { serviceDate: true, type: true, roomSize: true, basePrice: true, additionalFee: true, total: true },
    })
    console.log(`\n${c.name}:`, last)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
