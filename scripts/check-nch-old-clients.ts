import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const ids = {
    '(NCH) The One at Fayetteville': '6fa59529-87c9-495d-af02-94f30aa2f547',
    '(NCH) West End at Fayetteville': '1cea719e-3e9d-449a-ae78-1902b33935ab',
  }

  for (const [name, id] of Object.entries(ids)) {
    const services = await prisma.service.findMany({
      where: { clientId: id },
      select: { serviceNumber: true, serviceDate: true, unit: true, total: true, status: true },
    })
    console.log(`\n${name} (${id})`)
    console.log('Services:', services.length)
    for (const s of services) console.log(JSON.stringify(s))

    const invoices = await prisma.invoice.findMany({
      where: { clientId: id },
      select: { id: true, invoiceNumber: true, subtotal: true, status: true, issuedAt: true },
    })
    console.log('Invoices:', invoices.length)
    for (const inv of invoices) console.log(JSON.stringify(inv))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
