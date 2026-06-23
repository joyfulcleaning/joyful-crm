import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const names = ['The One at Hope Mills', 'South Main', 'Jamestown Commons', 'The One at Fayetteville']
  for (const n of names) {
    const clients = await prisma.client.findMany({
      where: { name: { contains: n, mode: 'insensitive' } },
      include: { management: true },
    })
    for (const c of clients) {
      console.log(`\n--- ${c.name} (${c.id}) status:${c.status} ---`)
      console.log('address:', c.address, c.city, c.state, c.zip)
      console.log('priceRef:', JSON.stringify(c.priceRef))
      console.log('management:', c.management?.name ?? 'none')
      console.log('priceConditions:', JSON.stringify(c.management?.priceConditions))
    }
  }

  // Modelo precedent at The One at Hope Mills
  const hopeMills = await prisma.client.findFirst({ where: { name: { contains: 'Hope Mills', mode: 'insensitive' } } })
  if (hopeMills) {
    const modelo = await prisma.service.findMany({
      where: { clientId: hopeMills.id },
      orderBy: { serviceDate: 'desc' },
      take: 15,
      select: { serviceNumber: true, serviceDate: true, type: true, unit: true, roomSize: true, basePrice: true, total: true, internalNotes: true },
    })
    console.log('\n--- Recent The One at Hope Mills services ---')
    for (const s of modelo) console.log(JSON.stringify(s))
  }

  // 114 3BR DC precedent at Jamestown Commons
  const jamestown = await prisma.client.findFirst({ where: { name: { contains: 'Jamestown', mode: 'insensitive' } } })
  if (jamestown) {
    const recent = await prisma.service.findMany({
      where: { clientId: jamestown.id },
      orderBy: { serviceDate: 'desc' },
      take: 15,
      select: { serviceNumber: true, serviceDate: true, type: true, unit: true, roomSize: true, basePrice: true, total: true },
    })
    console.log('\n--- Recent Jamestown Commons services ---')
    for (const s of recent) console.log(JSON.stringify(s))
  }

  // staff lookup
  const staff = await prisma.user.findMany({
    where: { name: { in: ['Taymie', 'Jenifer', 'Lizyanis', 'Melcy', 'Nathasha'], mode: 'insensitive' } },
    select: { id: true, name: true, role: true },
  })
  console.log('\n--- Staff exact match ---')
  for (const s of staff) console.log(JSON.stringify(s))

  const staffFuzzy = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
  })
  console.log('\n--- All users ---')
  for (const s of staffFuzzy) console.log(JSON.stringify(s))
}

main().catch(console.error).finally(() => prisma.$disconnect())
