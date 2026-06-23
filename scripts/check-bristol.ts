import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.client.findMany({
    where: { OR: [{ address: { contains: 'Glen Iris', mode: 'insensitive' } }, { name: { contains: 'Bristol', mode: 'insensitive' } }] },
    select: { id: true, name: true, address: true, status: true },
  })
  console.log(rows)
}
main().catch(console.error).finally(() => prisma.$disconnect())
