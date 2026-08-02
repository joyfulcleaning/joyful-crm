import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const APPLY = process.argv.includes('--apply')

async function main() {
  const services = await prisma.service.findMany({
    where: {
      status: 'pending',
      serviceDate: { gte: new Date('2026-07-01T00:00:00.000Z'), lte: new Date('2026-07-31T23:59:59.999Z') },
    },
    select: { id: true, serviceNumber: true, serviceDate: true, client: { select: { name: true } } },
    orderBy: { serviceDate: 'asc' },
  })

  console.log(`Found ${services.length} pending service(s) between 2026-07-01 and 2026-07-31:`)
  services.forEach(s => console.log(`  #${s.serviceNumber}  ${s.serviceDate.toISOString().slice(0, 10)}  ${s.client?.name ?? ''}`))

  if (!APPLY) {
    console.log('\nDry run only — pass --apply to actually update these to "reschedule".')
    return
  }

  const result = await prisma.service.updateMany({
    where: { id: { in: services.map(s => s.id) } },
    data: { status: 'reschedule' },
  })
  console.log(`\nUpdated ${result.count} service(s) to status "reschedule".`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
