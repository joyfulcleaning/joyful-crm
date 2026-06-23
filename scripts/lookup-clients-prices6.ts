import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clients = await prisma.client.findMany({
    where: { name: { contains: 'Cumberland', mode: 'insensitive' } },
    include: { management: true },
  })
  for (const c of clients) {
    console.log(`\n--- ${c.name} (${c.id}) ---`)
    console.log('address:', c.address)
    console.log('priceRef:', JSON.stringify(c.priceRef))
    console.log('management:', c.management?.name ?? 'none')
    console.log('management.priceConditions:', JSON.stringify(c.management?.priceConditions, null, 2))
  }

  const recent = await prisma.service.findMany({
    where: { client: { name: { contains: 'Cumberland', mode: 'insensitive' } } },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true },
  })
  console.log('\n--- Recent Cumberland services ---')
  for (const s of recent) console.log(JSON.stringify(s))

  // The One at Fayetteville office price precedent
  const office = await prisma.service.findMany({
    where: { client: { name: { contains: 'The One at Fayetteville', mode: 'insensitive' } }, unit: { contains: 'Office', mode: 'insensitive' } },
    orderBy: { serviceDate: 'desc' },
    take: 5,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- The One at Fayetteville Office precedents ---')
  for (const s of office) console.log(JSON.stringify(s))
}

main().catch(console.error).finally(() => prisma.$disconnect())
