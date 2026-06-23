import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    select: { id: true, serviceNumber: true, status: true, serviceDate: true, client: { select: { name: true } } },
    orderBy: { serviceNumber: 'asc' }
  })

  const groups = new Map<number, typeof services>()
  for (const s of services) {
    if (!groups.has(s.serviceNumber)) groups.set(s.serviceNumber, [])
    groups.get(s.serviceNumber)!.push(s)
  }

  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1)

  console.log(`Total services: ${services.length}`)
  console.log(`Duplicate serviceNumbers: ${dupes.length} numbers shared by ${dupes.reduce((s, [, l]) => s + l.length, 0)} services\n`)

  for (const [num, list] of dupes) {
    console.log(`serviceNumber #${num} (${list.length} services):`)
    for (const s of list) {
      console.log(`  id=${s.id} | ${s.serviceDate?.toISOString().split('T')[0]} | ${s.status} | ${s.client?.name}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
