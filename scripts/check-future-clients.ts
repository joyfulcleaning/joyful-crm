import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const names = ['Bristol Park', 'Karen Lake', 'Village Chase', 'Wayside', 'Dotson', 'Franklin', 'Hope Mills', 'Rim Creek', 'Austin Creek', 'Buckhead', 'Raeford']
  for (const n of names) {
    const clients = await prisma.client.findMany({
      where: { OR: [{ name: { contains: n, mode: 'insensitive' } }, { address: { contains: n, mode: 'insensitive' } }] },
      select: { id: true, name: true, address: true, status: true, management: { select: { name: true } } },
    })
    console.log(`\n-- "${n}" --`)
    for (const c of clients) console.log(`  ${c.id}  ${c.name}  | ${c.address} | ${c.status} | mgmt=${c.management?.name ?? 'none'}`)
  }

  console.log('\n-- Existing services with serviceDate >= 2026-06-29 --')
  const existing = await prisma.service.findMany({
    where: { serviceDate: { gte: new Date('2026-06-29T00:00:00.000Z') } },
    select: { serviceNumber: true, serviceDate: true, client: { select: { name: true } } },
    orderBy: { serviceDate: 'asc' },
  })
  console.log(`Total: ${existing.length}`)
  for (const s of existing) console.log(`  #${s.serviceNumber}  ${s.serviceDate.toISOString().slice(0,10)}  ${s.client.name}`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
