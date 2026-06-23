import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const inactiveNch = await prisma.client.findMany({
    where: { name: { contains: 'NCH', mode: 'insensitive' } },
  })
  console.log('NCH-prefixed clients:')
  for (const c of inactiveNch) console.log(c.id, '|', c.name, '| status:', c.status)

  for (const c of inactiveNch) {
    const services = await prisma.service.findMany({
      where: { clientId: c.id, serviceDate: { gte: new Date('2026-06-01') } },
      select: { serviceNumber: true, serviceDate: true, unit: true, roomSize: true, numericKey: true, internalNotes: true, basePrice: true },
      orderBy: { serviceNumber: 'asc' },
    })
    if (services.length) {
      console.log(`\nServices for ${c.name} (${c.id}):`)
      for (const s of services) console.log(JSON.stringify(s))
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
