import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SOUTHERN_PINES = '49e877a0-39fa-49e6-8c82-d9152c0c130d'
const JAMESTOWN       = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const THE_ONE         = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const WEST_END        = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const WATERFORD       = '2b3ce58f-ece1-4e8a-8779-b9807435fc69'

const ADDR: Record<string, string> = {
  [SOUTHERN_PINES]: '800 Churchill Downs Dr, Aberdeen, NC 28315',
  [JAMESTOWN]:      '1429 Bozeman Loop, Fayetteville, NC 28303',
  [THE_ONE]:        '3010 Valentina Way, Fayetteville, NC 28314',
  [WEST_END]:       '3050 Plantation Garden Blvd, Fayetteville, NC 28303',
  [WATERFORD]:      '801 Shell Dr, Spring Lake, NC 28390',
}

const STAFF_NAMES = ['Taymie Diaz', 'Jenifer Dubon', 'Lizyanis Alvarez Aguirre (Liz)', 'Melsy Barrera Franco (Aracelis)']

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin', name: 'Admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')

  const staffUsers = await prisma.user.findMany({ where: { name: { in: STAFF_NAMES } }, select: { id: true, name: true } })
  if (staffUsers.length !== STAFF_NAMES.length) throw new Error('Missing staff: ' + JSON.stringify(staffUsers))
  console.log('Staff:', staffUsers.map(s => s.name).join(', '))

  const MON = new Date('2026-06-15T12:00:00.000Z')

  const services = [
    { clientId: SOUTHERN_PINES, time: '09:00', type: 'Standard Clean', unit: '5208',     roomSize: '3BR',             basePrice: 150, additionalFee: 0 },
    { clientId: SOUTHERN_PINES, time: '10:00', type: 'Standard Clean', unit: '2207',     roomSize: '3BR',             basePrice: 150, additionalFee: 0 },
    { clientId: SOUTHERN_PINES, time: '11:00', type: 'Standard Clean', unit: 'Office',   roomSize: 'Office/Amenities', basePrice: 250, additionalFee: 0 },
    { clientId: JAMESTOWN,      time: '13:30', type: 'Standard Clean', unit: '100',      roomSize: '2BR',             basePrice: 120, additionalFee: 0 },
    { clientId: THE_ONE,        time: '15:00', type: 'Standard Clean', unit: '3025-103', roomSize: '1BR',             basePrice: 100, additionalFee: 0 },
    { clientId: WEST_END,       time: '16:00', type: 'Standard Clean', unit: '855-102',  roomSize: '2BR',             basePrice: 120, additionalFee: 0 },
    { clientId: WATERFORD,      time: '16:00', type: 'Touch Up',       unit: '28',       roomSize: '1BR',             basePrice: 100, additionalFee: 0 },
  ]

  for (const s of services) {
    const total = s.basePrice + s.additionalFee
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   MON,
        serviceTime:   s.time,
        type:          s.type,
        status:        'pending',
        address:       ADDR[s.clientId],
        unit:          s.unit ?? null,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: s.additionalFee,
        total,
        frequency:     'one_time',
        staff: { create: staffUsers.map(u => ({ userId: u.id })) },
      },
      select: { serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  2026-06-15 ${s.time}  ${s.unit ?? s.roomSize}  $${total}`)
  }

  console.log(`\nAll ${services.length} services created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
