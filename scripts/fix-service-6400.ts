import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const service = await prisma.service.findFirst({ where: { serviceNumber: 6400 }, select: { id: true, invoicedAt: true } })
  if (!service) throw new Error('Service #6400 not found')

  const invoiceItem = await prisma.invoiceItem.findFirst({
    where: { serviceId: service.id, invoice: { invoiceNumber: 'JOYFUL108' } },
    include: { invoice: { select: { invoiceNumber: true, updatedAt: true } } },
  })
  if (!invoiceItem) throw new Error('Service #6400 has no InvoiceItem linked to JOYFUL108')

  const updated = await prisma.service.update({
    where: { id: service.id },
    data: { invoicedAt: invoiceItem.invoice.updatedAt },
    select: { serviceNumber: true, invoicedAt: true },
  })
  console.log('Updated service:', JSON.stringify(updated, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
