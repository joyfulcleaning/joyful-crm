import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const names = ['Susie', 'Annette', 'Southern Pines', 'West End', 'The One']

  for (const name of names) {
    const clients = await prisma.client.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: { management: true },
    })
    for (const c of clients) {
      console.log(`\n--- ${c.name} (${c.id}) ---`)
      console.log('address:', c.address)
      console.log('type:', c.type)
      console.log('priceRef:', JSON.stringify(c.priceRef, null, 2))
      console.log('management:', c.management?.name ?? 'none')
      console.log('management.priceConditions:', JSON.stringify(c.management?.priceConditions, null, 2))
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
