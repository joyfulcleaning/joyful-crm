import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.service.findFirst({ where: { serviceNumber: 6361 }, select: { id: true } })
  if (!existing) throw new Error('Service #6361 not found')

  const updated = await prisma.service.update({
    where: { id: existing.id },
    data: {
      client: { connect: { id: 'cec385b5-d1b5-4c68-8f43-befeea83c764' } },
      address: '3010 Valentina Way, Fayetteville, NC 28314',
      internalNotes: 'The One at Fayetteville',
    },
    include: { client: { select: { name: true } } },
  })
  console.log('Updated #6361:', JSON.stringify({
    client: updated.client.name,
    address: updated.address,
    internalNotes: updated.internalNotes,
    unit: updated.unit,
    roomSize: updated.roomSize,
    basePrice: updated.basePrice,
  }, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
