import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const UNINVOICED_DUPE_IDS = [
  // #6007 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6007, date: '2026-06-01', client: 'Southern Pines Reserve' },
  // #6008 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6008, date: '2026-06-01', client: 'Southern Pines Reserve' },
  // #6010 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6010, date: '2026-06-01', client: 'Southern Pines Reserve' },
  // #6011 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6011, date: '2026-06-01', client: 'Southern Pines Reserve' },
  // #6012 National Corporate Housing 2026-06-01
  { serviceNumber: 6012, date: '2026-06-01', client: 'National Corporate Housing' },
  // #6013 National Corporate Housing 2026-06-01
  { serviceNumber: 6013, date: '2026-06-01', client: 'National Corporate Housing' },
  // #6014 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6014, date: '2026-06-01', client: 'Southern Pines Reserve' },
  // #6015 Southern Pines Reserve 2026-06-01
  { serviceNumber: 6015, date: '2026-06-01', client: 'Southern Pines Reserve' },
]

async function main() {
  // Get the services to renumber — uninvoiced, on 2026-06-01, with those specific numbers
  const targetDate = new Date('2026-06-01T00:00:00.000Z')
  const nextDay    = new Date('2026-06-02T00:00:00.000Z')

  const services = await prisma.service.findMany({
    where: {
      invoicedAt: null,
      serviceDate: { gte: targetDate, lt: nextDay },
      serviceNumber: { in: UNINVOICED_DUPE_IDS.map(d => d.serviceNumber) }
    },
    include: { client: { select: { name: true } } },
    orderBy: { serviceNumber: 'asc' }
  })

  console.log(`Found ${services.length} services to renumber`)
  if (services.length !== 8) {
    console.error('Expected 8 services — aborting for safety')
    return
  }

  // Verify none are in any invoice item
  const ids = services.map(s => s.id)
  const inInvoice = await prisma.invoiceItem.findFirst({ where: { serviceId: { in: ids } } })
  if (inInvoice) {
    console.error('One or more services are already in an invoice — aborting')
    return
  }

  // Start from max+1
  const maxSvc = await prisma.service.findFirst({ orderBy: { serviceNumber: 'desc' }, select: { serviceNumber: true } })
  let nextNum = (maxSvc?.serviceNumber ?? 6379) + 1

  console.log(`\nRenumbering from #${nextNum}:`)

  for (const svc of services) {
    const newNum = nextNum++
    await prisma.service.update({ where: { id: svc.id }, data: { serviceNumber: newNum } })
    console.log(`  #${svc.serviceNumber} → #${newNum}  |  ${svc.serviceDate?.toISOString().split('T')[0]}  |  ${svc.client?.name}  |  $${Number(svc.total)}`)
  }

  // Update the sequence so future services continue from the new max
  await prisma.$executeRaw`SELECT setval('service_number_seq', ${nextNum - 1})`
  console.log(`\nSequence updated to ${nextNum - 1}`)
  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
