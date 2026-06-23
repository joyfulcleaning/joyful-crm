import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const c = await prisma.client.findUnique({
    where: { id: '6fa59529-87c9-495d-af02-94f30aa2f547' },
  })
  console.log('Client 6fa59529:', JSON.stringify(c, null, 2))

  const nch = await prisma.client.findMany({
    where: { name: { contains: 'National', mode: 'insensitive' } },
  })
  console.log('\nAll National Corporate Housing clients:')
  for (const c of nch) console.log(c.id, '|', c.name, '| active:', c.isActive, '| deleted:', (c as any).deletedAt ?? (c as any).isDeleted)
}

main().catch(console.error).finally(() => prisma.$disconnect())
