import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const targets = [
    { name: 'Waterford', id: '2b3ce58f-ece1-4e8a-8779-b9807435fc69' },
    { name: 'Southern Pines Reserve', id: '49e877a0-39fa-49e6-8c82-d9152c0c130d' },
  ]
  for (const t of targets) {
    const rows = await prisma.service.findMany({
      where: { clientId: t.id, roomSize: { contains: 'Office', mode: 'insensitive' } },
      orderBy: { serviceDate: 'desc' },
      select: { serviceDate: true, unit: true, roomSize: true, basePrice: true, frequency: true },
      take: 10,
    })
    console.log(`\n-- ${t.name} Office/Amenities precedent --`)
    for (const r of rows) console.log(`  ${r.serviceDate.toISOString().slice(0,10)}  ${r.unit}  $${r.basePrice}  freq=${r.frequency}`)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
