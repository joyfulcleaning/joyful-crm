import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const modelo = await prisma.service.findMany({
    where: { OR: [{ unit: { contains: 'Modelo', mode: 'insensitive' } }, { roomSize: { contains: 'Modelo', mode: 'insensitive' } }, { internalNotes: { contains: 'Modelo', mode: 'insensitive' } }] },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('--- Modelo services ---')
  for (const s of modelo) console.log(JSON.stringify(s))

  const touchUp = await prisma.service.findMany({
    where: { type: 'Touch Up' },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- Touch Up services ---')
  for (const s of touchUp) console.log(JSON.stringify(s))

  // Corporate Living Solutions priceConditions
  const cls = await prisma.client.findUnique({
    where: { id: 'c80d03d0-c5e1-4411-aaf9-3226c898f703' },
    include: { management: true },
  })
  console.log('\n--- Corporate Living Solutions ---')
  console.log('priceRef:', JSON.stringify(cls?.priceRef))
  console.log('management.priceConditions:', JSON.stringify(cls?.management?.priceConditions, null, 2))

  // recent services for that client
  const recentCLS = await prisma.service.findMany({
    where: { clientId: 'c80d03d0-c5e1-4411-aaf9-3226c898f703' },
    orderBy: { serviceDate: 'desc' },
    take: 5,
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true },
  })
  console.log('recent CLS services:', JSON.stringify(recentCLS, null, 2))

  // 1110 / 1091 units - which client are they normally under (Hawthorne West End or NCH)?
  const units = await prisma.service.findMany({
    where: { unit: { in: ['1110-207', '1091-307', '854-206', '3411-106', '199', '69', '28', '847-303'] } },
    orderBy: { serviceDate: 'desc' },
    select: { type: true, unit: true, roomSize: true, basePrice: true, total: true, serviceDate: true, client: { select: { name: true } } },
  })
  console.log('\n--- Specific unit history ---')
  for (const s of units) console.log(JSON.stringify(s))
}

main().catch(console.error).finally(() => prisma.$disconnect())
