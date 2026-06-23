import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const c = await prisma.client.findUnique({
    where: { id: 'cec385b5-d1b5-4c68-8f43-befeea83c764' },
    include: { management: true },
  })
  console.log('National Corporate Housing:', JSON.stringify(c, null, 2))

  // recent services for this client to see how notes/internalNotes describe property
  const recent = await prisma.service.findMany({
    where: { clientId: 'cec385b5-d1b5-4c68-8f43-befeea83c764' },
    orderBy: { serviceDate: 'desc' },
    take: 10,
    select: { serviceNumber: true, serviceDate: true, unit: true, roomSize: true, numericKey: true, internalNotes: true, notes: true, address: true },
  })
  console.log('\nRecent NCH services:')
  for (const s of recent) console.log(JSON.stringify(s))

  // the bad service we just created
  const bad = await prisma.service.findUnique({
    where: { id: undefined as any },
  }).catch(() => null)

  const created = await prisma.service.findFirst({
    where: { serviceNumber: 6361 },
    include: { client: true },
  })
  console.log('\nService #6361:', JSON.stringify(created, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
