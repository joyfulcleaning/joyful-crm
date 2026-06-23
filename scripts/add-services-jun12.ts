import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const HOPE_MILLS    = '95c2f15e-a6fb-4f44-b193-53ce668e413f'
const SOUTH_MAIN    = '572f36eb-ffe8-4380-b632-621e7a41094e'
const JAMESTOWN     = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const NCH           = 'cec385b5-d1b5-4c68-8f43-befeea83c764' // National Corporate Housing

const ADDR: Record<string, string> = {
  [HOPE_MILLS]: '3680 Elk Rd, Hope Mills, NC 28348',
  [SOUTH_MAIN]: '4003 William M Bill Luther St, Hope Mills, NC 28348',
  [JAMESTOWN]:  '1429 Bozeman Loop, Fayetteville, NC 28303',
  [NCH]:        '3010 Valentina Way, Fayetteville, NC 28314',
}

const STAFF_NAMES = ['Taymie Diaz', 'Jenifer Dubon', 'Lizyanis Alvarez Aguirre (Liz)', 'Melsy Barrera Franco (Aracelis)', 'Nathasha Salcedo']

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin', name: 'Admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')

  const staffUsers = await prisma.user.findMany({ where: { name: { in: STAFF_NAMES } }, select: { id: true, name: true } })
  if (staffUsers.length !== STAFF_NAMES.length) throw new Error('Missing staff: ' + JSON.stringify(staffUsers))
  console.log('Staff:', staffUsers.map(s => s.name).join(', '))

  const FRI = new Date('2026-06-12T12:00:00.000Z')

  const services = [
    { clientId: HOPE_MILLS, time: '08:00', type: 'Standard Clean', unit: 'Office/Amenities', roomSize: 'Office/Amenities', basePrice: 195, additionalFee: 0 },
    { clientId: HOPE_MILLS, time: '09:25', type: 'Standard Clean', unit: 'El Modelo',         roomSize: '2BR',             basePrice: 100, additionalFee: 0 },
    { clientId: SOUTH_MAIN, time: '10:30', type: 'Standard Clean', unit: '24',                roomSize: '2BR',             basePrice: 120, additionalFee: 0 },
    { clientId: SOUTH_MAIN, time: '11:30', type: 'Standard Clean', unit: '65',                roomSize: '2BR',             basePrice: 120, additionalFee: 0 },
    { clientId: JAMESTOWN,  time: '14:00', type: 'Standard Clean', unit: '35',                roomSize: '2BR',             basePrice: 120, additionalFee: 0 },
    { clientId: JAMESTOWN,  time: '15:00', type: 'Deep Clean',     unit: '114',               roomSize: '3BR',             basePrice: 140, additionalFee: 100 },
    { clientId: NCH,        time: '16:35', type: 'Standard Clean', unit: '3055-308',          roomSize: '1BR', numericKey: '7342', basePrice: 130, additionalFee: 0, internalNotes: 'The One At Fayetteville' },
  ]

  for (const s of services) {
    const total = s.basePrice + s.additionalFee
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   FRI,
        serviceTime:   s.time,
        type:          s.type,
        status:        'pending',
        address:       ADDR[s.clientId],
        unit:          s.unit ?? null,
        numericKey:    (s as any).numericKey ?? null,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: s.additionalFee,
        total,
        internalNotes: (s as any).internalNotes ?? null,
        frequency:     'one_time',
        staff: { create: staffUsers.map(u => ({ userId: u.id })) },
      },
      select: { serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  2026-06-12 ${s.time}  ${s.unit ?? s.roomSize}  $${total}`)
  }

  console.log(`\nAll ${services.length} services created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
