import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const ids = [
    '6fa59529-87c9-495d-af02-94f30aa2f547', // (NCH) The One at Fayetteville
    '1cea719e-3e9d-449a-ae78-1902b33935ab', // (NCH) West End at Fayetteville
  ]

  for (const id of ids) {
    const c = await prisma.client.findUnique({ where: { id } })
    if (!c) { console.log(`Client ${id} not found, skipping`); continue }
    await prisma.client.delete({ where: { id } })
    console.log(`Deleted: ${c.name} (${id})`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
