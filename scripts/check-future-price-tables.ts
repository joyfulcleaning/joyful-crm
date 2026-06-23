import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const IDS = [
  'b39457c9-d7e8-454b-a314-1309e1132b44', // Karen Lake
  'd1b4aace-6688-4de9-9744-a8919c8fab28', // Village Chase
  'bca12fdc-73e3-411a-9658-90317c69223a', // Franklin Cleaning
  '73141827-7404-41d5-8240-f39820ed3b2a', // South Pointe at Wayside
  '7c9f5426-5c4c-4770-bfa6-da43efc5dd49', // Wayside
]
async function main() {
  const clients = await prisma.client.findMany({ where: { id: { in: IDS } }, include: { management: true } })
  for (const c of clients) {
    console.log(`\n=== ${c.name} (${c.id}) status=${c.status} ===`)
    console.log('address:', c.address)
    console.log('priceRef:', JSON.stringify(c.priceRef))
    console.log('management:', c.management?.name ?? 'none')
    if (c.management?.priceConditions) console.log('priceConditions:', JSON.stringify(c.management.priceConditions))
  }

  // recent service history for Wayside-named clients & Karen Lake & Village Chase & Franklin
  for (const id of IDS) {
    const rows = await prisma.service.findMany({ where: { clientId: id }, orderBy: { serviceDate: 'desc' }, take: 5, select: { serviceDate: true, unit: true, roomSize: true, type: true, basePrice: true } })
    console.log(`\n-- recent services for ${id} --`)
    for (const r of rows) console.log(' ', r.serviceDate.toISOString().slice(0,10), r.unit, r.roomSize, r.type, '$'+r.basePrice)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
