import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const WEST_END_ADDR = '3050 Plantation Garden Blvd, Fayetteville, NC 28303'

async function main() {
  // List all National Corporate Housing services in June to review
  const all = await prisma.service.findMany({
    where: { clientId: 'cec385b5-d1b5-4c68-8f43-befeea83c764', serviceDate: { gte: new Date('2026-06-01') } },
    select: { id: true, serviceNumber: true, serviceDate: true, unit: true, roomSize: true, numericKey: true, address: true, internalNotes: true },
    orderBy: { serviceNumber: 'asc' },
  })
  console.log('All NCH services in June:')
  for (const s of all) console.log(`#${s.serviceNumber} | ${s.serviceDate.toISOString().slice(0,10)} | unit: ${s.unit} | address: ${s.address} | internalNotes: ${s.internalNotes}`)

  // Fix #6343, #6344, #6345 -> West End at Fayetteville
  const ids = all.filter(s => [6343, 6344, 6345].includes(s.serviceNumber)).map(s => s.id)
  for (const id of ids) {
    await prisma.service.update({
      where: { id },
      data: { address: WEST_END_ADDR, internalNotes: 'West End at Fayetteville' },
    })
  }
  console.log('\nFixed #6343, #6344, #6345 with internalNotes "West End at Fayetteville"')
}

main().catch(console.error).finally(() => prisma.$disconnect())
