import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const rows = [
    { key: 'notif.quoteRequest', value: 'true' },
    { key: 'notif.quoteRequest.push', value: 'true' },
    { key: 'notif.quoteRequest.roles', value: 'admin' },
  ]
  for (const row of rows) {
    const result = await prisma.setting.upsert({
      where: { key: row.key },
      update: {},
      create: row,
    })
    console.log('Setting:', JSON.stringify(result))
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
