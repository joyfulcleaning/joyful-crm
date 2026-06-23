import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const NCH_CORRECT = 'cec385b5-d1b5-4c68-8f43-befeea83c764' // National Corporate Housing
const WEST_END_ADDR = '3050 Plantation Garden Blvd, Fayetteville, NC 28303'
const FAYE_ADDR = '3010 Valentina Way, Fayetteville, NC 28314'

async function main() {
  const toFix = await prisma.service.findMany({
    where: { clientId: '1cea719e-3e9d-449a-ae78-1902b33935ab' },
    select: { id: true, serviceNumber: true, unit: true, roomSize: true, numericKey: true },
  })
  console.log('Found services using (NCH) West End at Fayetteville:', toFix.map(s => s.serviceNumber))

  for (const s of toFix) {
    await prisma.service.update({
      where: { id: s.id },
      data: {
        client: { connect: { id: NCH_CORRECT } },
        address: WEST_END_ADDR,
        internalNotes: 'West End at Fayetteville',
      },
    })
    console.log(`Fixed #${s.serviceNumber} (${s.unit})`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
