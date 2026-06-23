import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const IDS = [
  'e82f4f94-a7c7-44ac-b7de-87af36d45ceb', // Summit on 401
  'f939a8d5-a105-473b-bfb1-d70afc54d472', // The One at Fayetteville
  '1a676856-c362-418d-a65b-529a3b6b5fd5', // West End
  '572f36eb-ffe8-4380-b632-621e7a41094e', // South Main
  '19b5d837-fc16-462b-9c7e-ae562c806a3b', // Jamestown
  '56bb6687-b837-4f54-9c35-2ddf922cf21f', // Rim Creek
  'bc38f5a2-79bd-4079-8896-fc3c2dab5d1f', // Cumberland
  '2b3ce58f-ece1-4e8a-8779-b9807435fc69', // Waterford
  '49e877a0-39fa-49e6-8c82-d9152c0c130d', // Southern Pines Reserve
  'c63249dd-3bb7-4cb8-ab19-c1f46884931e', // Jill Cleaning
  '8b76dff3-60ba-47a5-9d3f-1228abf8134d', // Susie Cleaning
]

async function main() {
  const clients = await prisma.client.findMany({
    where: { id: { in: IDS } },
    include: { management: true },
  })
  for (const c of clients) {
    console.log(`\n=== ${c.name} (${c.id}) ===`)
    console.log('priceRef:', JSON.stringify(c.priceRef, null, 2))
    console.log('management:', c.management?.name ?? 'none')
    if (c.management?.priceConditions) {
      console.log('management.priceConditions:', JSON.stringify(c.management.priceConditions, null, 2))
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
