import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.service.findMany({
    where: { clientId: '7c9f5426-5c4c-4770-bfa6-da43efc5dd49' },
    select: { serviceDate: true, unit: true, address: true, roomSize: true, type: true, basePrice: true, internalNotes: true },
  })
  console.log(rows)
}
main().catch(console.error).finally(() => prisma.$disconnect())
