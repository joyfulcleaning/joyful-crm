import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.service.groupBy({ by: ['type'], _count: { type: true } })
  for (const r of rows.sort((a,b)=>b._count.type-a._count.type)) console.log(r._count.type, r.type)
}
main().catch(console.error).finally(() => prisma.$disconnect())
