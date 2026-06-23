import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    where: { serviceNumber: { in: [6336, 6337, 6338] } },
    include: { client: { select: { name: true, id: true, status: true } } },
  })
  for (const s of services) {
    console.log(`#${s.serviceNumber} | client: ${s.client.name} (${s.client.id}, status: ${s.client.status}) | unit: ${s.unit} | numericKey: ${s.numericKey} | internalNotes: ${s.internalNotes}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
