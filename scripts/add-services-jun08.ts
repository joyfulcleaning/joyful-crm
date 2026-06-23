import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true, name: true },
  })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)

  const DATE = new Date('2026-06-08T12:00:00.000Z')

  const services = [
    {
      label: 'Susie cleaning (habitado)',
      clientId: '8b76dff3-60ba-47a5-9d3f-1228abf8134d',
      serviceTime: '09:30',
      type: 'Standard Clean',
      address: '270 Mckenzie Rd W Pinehurst, NC, United States',
      unit: null,
      roomSize: 'Other',
      basePrice: 160,
      additionalFee: 0,
      total: 160,
    },
    {
      label: 'Annette Regular cleaning',
      clientId: '3f20fd48-bdc5-440e-a616-86ac991255f3',
      serviceTime: '10:40',
      type: 'Standard Clean',
      address: '1170 Morganton Rd Pinehurst, NC, United States',
      unit: null,
      roomSize: 'Other',
      basePrice: 200,
      additionalFee: 0,
      total: 200,
    },
    {
      label: 'Southern Pines Office/amenities',
      clientId: '49e877a0-39fa-49e6-8c82-d9152c0c130d',
      serviceTime: '12:30',
      type: 'Standard Clean',
      address: '800 Churchill Downs Dr, Aberdeen, NC 28315',
      unit: null,
      roomSize: null,
      basePrice: 250,
      additionalFee: 0,
      total: 250,
      staffNotes: 'Office/amenities',
    },
    {
      label: 'Southern Pines 4302 1BR',
      clientId: '49e877a0-39fa-49e6-8c82-d9152c0c130d',
      serviceTime: '13:00',
      type: 'Standard Clean',
      address: '800 Churchill Downs Dr, Aberdeen, NC 28315',
      unit: '4302',
      roomSize: '1BR',
      basePrice: 110,
      additionalFee: 0,
      total: 110,
    },
    {
      label: 'Southern Pines 5606 1BR',
      clientId: '49e877a0-39fa-49e6-8c82-d9152c0c130d',
      serviceTime: '14:00',
      type: 'Standard Clean',
      address: '800 Churchill Downs Dr, Aberdeen, NC 28315',
      unit: '5606',
      roomSize: '1BR',
      basePrice: 110,
      additionalFee: 0,
      total: 110,
    },
    {
      label: 'Southern Pines 5505 1BR',
      clientId: '49e877a0-39fa-49e6-8c82-d9152c0c130d',
      serviceTime: '15:00',
      type: 'Standard Clean',
      address: '800 Churchill Downs Dr, Aberdeen, NC 28315',
      unit: '5505',
      roomSize: '1BR',
      basePrice: 110,
      additionalFee: 0,
      total: 110,
    },
    {
      label: 'West End 1090-203 2BR',
      clientId: '1a676856-c362-418d-a65b-529a3b6b5fd5',
      serviceTime: '15:30',
      type: 'Standard Clean',
      address: '3050 Plantation Garden Blvd',
      unit: '1090-203',
      roomSize: '2BR',
      basePrice: 120,
      additionalFee: 0,
      total: 120,
    },
    {
      label: 'West End 3134-106 2BR',
      clientId: '1a676856-c362-418d-a65b-529a3b6b5fd5',
      serviceTime: '15:30',
      type: 'Standard Clean',
      address: '3050 Plantation Garden Blvd',
      unit: '3134-106',
      roomSize: '2BR',
      basePrice: 120,
      additionalFee: 0,
      total: 120,
    },
    {
      label: 'The One 3070-308 2x2',
      clientId: 'f939a8d5-a105-473b-bfb1-d70afc54d472',
      serviceTime: '17:30',
      type: 'Standard Clean',
      address: '3010 Valentina Way, Fayetteville, NC 28314',
      unit: '3070-308',
      roomSize: '2x2',
      basePrice: 120,
      additionalFee: 0,
      total: 120,
    },
  ]

  for (const s of services) {
    const created = await prisma.service.create({
      data: {
        client:      { connect: { id: s.clientId } },
        createdBy:   { connect: { id: admin.id } },
        serviceDate: DATE,
        serviceTime: s.serviceTime,
        type:        s.type,
        status:      'pending',
        address:     s.address,
        unit:        s.unit,
        roomSize:    s.roomSize,
        basePrice:   s.basePrice,
        additionalFee: s.additionalFee,
        total:       s.total,
        staffNotes:  (s as any).staffNotes ?? null,
        frequency:   'one_time',
      },
      select: { serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  ${s.label}  $${s.total}`)
  }

  console.log('\nAll 9 services created.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
