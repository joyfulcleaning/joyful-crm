import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    select: { serviceNumber: true, serviceDate: true },
    orderBy: { serviceNumber: 'asc' }
  })

  const groups = new Map<number, typeof services>()
  for (const s of services) {
    if (!groups.has(s.serviceNumber)) groups.set(s.serviceNumber, [])
    groups.get(s.serviceNumber)!.push(s)
  }

  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1)

  const nums = dupes.map(([n]) => n)
  console.log(`Duplicate range: #${Math.min(...nums)} to #${Math.max(...nums)}`)

  // Group by month to see which months collide
  const monthCounts = new Map<string, number>()
  for (const [, list] of dupes) {
    for (const s of list) {
      const m = s.serviceDate?.toISOString().slice(0, 7) ?? 'unknown'
      monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)
    }
  }
  console.log('\nDuplicates per month:')
  for (const [m, c] of [...monthCounts.entries()].sort()) {
    console.log(`  ${m}: ${c} services`)
  }

  // Check the max serviceNumber currently in DB
  const maxSvc = await prisma.service.findFirst({ orderBy: { serviceNumber: 'desc' }, select: { serviceNumber: true } })
  console.log(`\nMax serviceNumber in DB: #${maxSvc?.serviceNumber}`)

  // Show the auto-increment sequence value (postgres)
  // Check how serviceNumber is generated
  const seq = await prisma.$queryRaw<any[]>`SELECT last_value FROM "service_number_seq"` .catch(() => null)
  if (seq) console.log('Sequence last_value:', seq[0]?.last_value)
}

main().catch(console.error).finally(() => prisma.$disconnect())
