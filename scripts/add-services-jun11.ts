import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const THE_ONE_FAYE     = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const NCH_THE_ONE_FAYE = '6fa59529-87c9-495d-af02-94f30aa2f547'
const WEST_END         = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const CUMBERLAND       = 'bc38f5a2-79bd-4079-8896-fc3c2dab5d1f'
const SUMMIT_401       = 'e82f4f94-a7c7-44ac-b7de-87af36d45ceb'
const AUSTIN_CREEK     = '7c7e843e-b345-42e1-a7a5-1a05294b6eb4'

const ADDR: Record<string, string> = {
  [THE_ONE_FAYE]:     '3010 Valentina Way, Fayetteville, NC 28314',
  [NCH_THE_ONE_FAYE]: '3010 Valentina Way, Fayetteville, NC 28314',
  [WEST_END]:         '3050 Plantation Garden Blvd',
  [CUMBERLAND]:       '2580 Cumberland Creek Dr',
  [SUMMIT_401]:       '3325 Oak Forest Dr',
  [AUSTIN_CREEK]:     '1131 Capeharbor Ct, Fayetteville, NC 28314',
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)

  const THU = new Date('2026-06-11T12:00:00.000Z')

  const services = [
    { clientId: THE_ONE_FAYE,     time: '08:00', type: 'Standard Clean', unit: 'Office/Amenities', roomSize: 'Office/Amenities', basePrice: 195 },
    { clientId: WEST_END,         time: '09:45', type: 'Standard Clean', unit: '850-105',  roomSize: '2BR', basePrice: 120 },
    { clientId: CUMBERLAND,       time: '11:00', type: 'Standard Clean', unit: '2570-203', roomSize: '1BR', basePrice: 110 },
    { clientId: SUMMIT_401,       time: '13:00', type: 'Standard Clean', unit: '3430-206', roomSize: '2BR', basePrice: 120 },
    { clientId: AUSTIN_CREEK,     time: '14:00', type: 'Standard Clean', unit: '26',       roomSize: '2BR', basePrice: 120 },
    { clientId: AUSTIN_CREEK,     time: '15:00', type: 'Standard Clean', unit: '44',       roomSize: '2BR', basePrice: 120 },
    { clientId: NCH_THE_ONE_FAYE, time: '16:00', type: 'Standard Clean', unit: '3055-308', roomSize: '1BR', basePrice: 130, numericKey: '7342' },
  ]

  for (const s of services) {
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   THU,
        serviceTime:   s.time,
        type:          s.type,
        status:        'completed',
        address:       ADDR[s.clientId],
        unit:          s.unit ?? null,
        numericKey:    (s as any).numericKey ?? null,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: 0,
        total:         s.basePrice,
        frequency:     'one_time',
      },
      select: { serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  2026-06-11 ${s.time}  ${s.unit ?? s.roomSize}  $${s.basePrice}`)
  }

  console.log(`\nAll ${services.length} services created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
