import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    where: { unit: { in: ['854-206', '1110-207', '1091-307'] } },
    include: { client: { select: { name: true, id: true, status: true } } },
  })
  for (const s of services) {
    console.log(`#${s.serviceNumber} | date: ${s.serviceDate.toISOString().slice(0,10)} | client: ${s.client.name} (${s.client.id}, status: ${s.client.status}) | unit: ${s.unit} | numericKey: ${s.numericKey} | internalNotes: ${s.internalNotes}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
