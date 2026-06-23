import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Restores the total values that were overwritten by fix-service-totals.ts
// Original totals are the values the user had manually set
const restores = [
  { serviceNumber: 6070, total: 230 },
  { serviceNumber: 6077, total: 140 },
  { serviceNumber: 6099, total: 100 },
  { serviceNumber: 6093, total: 175 },
  { serviceNumber: 6106, total: 190 },
  { serviceNumber: 6161, total: 225 },
  { serviceNumber: 6310, total: 195 },
  { serviceNumber: 6060, total: 175 },
  { serviceNumber: 6320, total: 120 },
]

async function main() {
  for (const r of restores) {
    const service = await prisma.service.findFirst({ where: { serviceNumber: r.serviceNumber } })
    if (!service) { console.log(`#${r.serviceNumber}: not found`); continue }
    await prisma.service.update({
      where: { id: service.id },
      data:  { total: r.total },
    })
    console.log(`#${r.serviceNumber}: total restored to $${r.total}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
