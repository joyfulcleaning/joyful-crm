import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { address: { contains: 'Scotch Hall', mode: 'insensitive' } },
        { name: { contains: 'Corporativa', mode: 'insensitive' } },
        { name: { contains: '847', mode: 'insensitive' } },
      ],
    },
    include: { management: true },
  })
  for (const c of clients) {
    console.log(`\n--- ${c.name} (${c.id}) ---`)
    console.log('address:', c.address)
    console.log('management:', c.management?.name ?? 'none')
  }
  console.log('\nTotal found:', clients.length)

  // Also check recent services for these properties to see how "Modelo" / "Office" / "DC" entries were priced before
  const recentWestEnd = await prisma.service.findMany({
    where: { client: { name: { contains: 'West End', mode: 'insensitive' } } },
    orderBy: { serviceDate: 'desc' },
    take: 15,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, staffNotes: true, internalNotes: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- Recent West End services ---')
  for (const s of recentWestEnd) console.log(JSON.stringify(s))

  const recentWaterford = await prisma.service.findMany({
    where: { client: { name: { contains: 'Waterford', mode: 'insensitive' } } },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, staffNotes: true, internalNotes: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- Recent Waterford services ---')
  for (const s of recentWaterford) console.log(JSON.stringify(s))
}

main().catch(console.error).finally(() => prisma.$disconnect())
