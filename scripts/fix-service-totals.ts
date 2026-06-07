import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    select: { id: true, serviceNumber: true, basePrice: true, additionalFee: true, total: true }
  })

  let fixed = 0
  for (const s of services) {
    const expected = Number(s.basePrice) + Number(s.additionalFee)
    const actual   = Number(s.total)
    if (Math.abs(expected - actual) > 0.01) {
      console.log(`#${s.serviceNumber}: basePrice=${s.basePrice} + fee=${s.additionalFee} = ${expected.toFixed(2)}, but total=${actual} → fixing`)
      await prisma.service.update({
        where: { id: s.id },
        data:  { total: expected },
      })
      fixed++
    }
  }
  console.log(`\nFixed ${fixed} service(s)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
