import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const names = [
    'Summit on 401',
    'The One at Fayetteville',
    'West End',
    'South Main',
    'Jamestown',
    'Rim Creek',
    'Cumberland',
    'Waterford',
    'Southern Pines',
  ]

  for (const n of names) {
    const clients = await prisma.client.findMany({
      where: { name: { contains: n, mode: 'insensitive' } },
      select: { id: true, name: true, address: true, status: true },
    })
    console.log(`\n-- "${n}" --`)
    for (const c of clients) console.log(`  ${c.id}  ${c.name}  | ${c.address} | ${c.status}`)
  }

  console.log('\n-- Possible matches for Hunters Ridge Trail (Dunn) --')
  const hunters = await prisma.client.findMany({
    where: { OR: [{ address: { contains: 'Hunters Ridge', mode: 'insensitive' } }, { name: { contains: 'Jill', mode: 'insensitive' } }] },
    select: { id: true, name: true, address: true, status: true },
  })
  for (const c of hunters) console.log(`  ${c.id}  ${c.name}  | ${c.address} | ${c.status}`)

  console.log('\n-- Possible matches for Mckenzie Rd (Pinehurst) --')
  const mckenzie = await prisma.client.findMany({
    where: { OR: [{ address: { contains: 'Mckenzie', mode: 'insensitive' } }, { name: { contains: 'Susie', mode: 'insensitive' } }] },
    select: { id: true, name: true, address: true, status: true },
  })
  for (const c of mckenzie) console.log(`  ${c.id}  ${c.name}  | ${c.address} | ${c.status}`)

  console.log('\n-- Existing services 2026-06-22 .. 2026-06-26 --')
  const existing = await prisma.service.findMany({
    where: { serviceDate: { gte: new Date('2026-06-22T00:00:00.000Z'), lte: new Date('2026-06-26T23:59:59.999Z') } },
    select: { id: true, serviceNumber: true, serviceDate: true, serviceTime: true, unit: true, roomSize: true, type: true, status: true, client: { select: { name: true } } },
    orderBy: [{ serviceDate: 'asc' }, { serviceTime: 'asc' }],
  })
  for (const s of existing) {
    console.log(`  #${s.serviceNumber}  ${s.serviceDate.toISOString().slice(0,10)} ${s.serviceTime}  ${s.client.name}  ${s.unit ?? s.roomSize}  ${s.type}  [${s.status}]`)
  }
  console.log(`Total existing in range: ${existing.length}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
