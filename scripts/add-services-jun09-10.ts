import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WATERFORD       = '2b3ce58f-ece1-4e8a-8779-b9807435fc69'
const THE_ONE_FAYE    = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const WEST_END        = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const NCH_WEST_END    = '1cea719e-3e9d-449a-ae78-1902b33935ab'
const AUSTIN_CREEK    = '7c7e843e-b345-42e1-a7a5-1a05294b6eb4'
const THE_ONE_HOPE    = '95c2f15e-a6fb-4f44-b193-53ce668e413f'
const RIM_CREEK       = '56bb6687-b837-4f54-9c35-2ddf922cf21f'
const CLS             = 'c80d03d0-c5e1-4411-aaf9-3226c898f703'
const JAMESTOWN       = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const SUMMIT_401      = 'e82f4f94-a7c7-44ac-b7de-87af36d45ceb'

const ADDR = {
  [WATERFORD]:    '801 Shell Dr, Spring Lake, NC 28390',
  [THE_ONE_FAYE]: '3010 Valentina Way, Fayetteville, NC 28314',
  [WEST_END]:     '3050 Plantation Garden Blvd',
  [NCH_WEST_END]: '3050 Plantation Garden Blvd, Fayetteville, NC 28303',
  [AUSTIN_CREEK]: '1131 Capeharbor Ct, Fayetteville, NC 28314',
  [THE_ONE_HOPE]: '3680 Elk Rd, Hope Mills, NC 28348',
  [RIM_CREEK]:    '4811 Cellner Dr, Fayetteville, NC 28314',
  [CLS]:          'West End At Fayetteville 847 Scotch Hall Way Unit 303',
  [JAMESTOWN]:    '1429 Bozeman Loop, Fayetteville, NC 28303',
  [SUMMIT_401]:   '3325 Oak Forest Dr',
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)

  const TUE = new Date('2026-06-09T12:00:00.000Z')
  const WED = new Date('2026-06-10T12:00:00.000Z')

  const services = [
    // ── Tuesday Jun 9 (completed) ──
    { date: TUE, status: 'completed', clientId: WATERFORD, time: '08:00', type: 'Standard Clean', unit: 'Office/Amenities/Modelo', roomSize: 'Office/Amenities', basePrice: 275 },
    { date: TUE, status: 'completed', clientId: WATERFORD, time: '09:30', type: 'Touch Up',       unit: '213',                    roomSize: '2BR',              basePrice: 120 },
    { date: TUE, status: 'completed', clientId: THE_ONE_FAYE, time: '09:40', type: 'Standard Clean', unit: '3040-204', roomSize: '1BR', basePrice: 100 },
    { date: TUE, status: 'completed', clientId: WEST_END,   time: '10:30', type: 'Standard Clean', unit: '854-304', roomSize: '2BR', basePrice: 120 },
    { date: TUE, status: 'completed', clientId: WEST_END,   time: '11:30', type: 'Standard Clean', unit: '3120-302', roomSize: '2BR', basePrice: 120 },
    { date: TUE, status: 'completed', clientId: AUSTIN_CREEK, time: '13:30', type: 'Standard Clean', unit: '4', roomSize: '2BR', basePrice: 120 },
    { date: TUE, status: 'completed', clientId: THE_ONE_HOPE, time: '15:00', type: 'Standard Clean', unit: '1020-101', roomSize: '2BR', basePrice: 120 },
    { date: TUE, status: 'completed', clientId: NCH_WEST_END, time: '16:35', type: 'Deep Clean',     unit: '854-206',  numericKey: '7338', roomSize: '2BR', basePrice: 150 },
    { date: TUE, status: 'completed', clientId: NCH_WEST_END, time: '18:00', type: 'Standard Clean', unit: '1110-207', numericKey: '7335', roomSize: '2BR', basePrice: 150 },
    { date: TUE, status: 'completed', clientId: NCH_WEST_END, time: '19:00', type: 'Standard Clean', unit: '1091-307', numericKey: '7332', roomSize: '1BR', basePrice: 130 },
    { date: TUE, status: 'completed', clientId: RIM_CREEK,  time: '20:00', type: 'Standard Clean', unit: '4890-F', roomSize: '3BR', basePrice: 140 },

    // ── Wednesday Jun 10 (pending) ──
    { date: WED, status: 'pending', clientId: WEST_END, time: '08:00', type: 'Standard Clean', unit: 'Office/Amenities', roomSize: null,     basePrice: 195 },
    { date: WED, status: 'pending', clientId: WEST_END, time: '09:20', type: 'Standard Clean', unit: null,               roomSize: 'Modelo', basePrice: 100 },
    { date: WED, status: 'pending', clientId: CLS,      time: '09:30', type: 'Standard Clean', unit: '847-303',  roomSize: '2BR', basePrice: 120 },
    { date: WED, status: 'pending', clientId: WEST_END, time: '10:30', type: 'Standard Clean', unit: '851-208',  roomSize: '1BR', basePrice: 100 },
    { date: WED, status: 'pending', clientId: JAMESTOWN, time: '13:00', type: 'Standard Clean', unit: '199', roomSize: '2BR', basePrice: 120 },
    { date: WED, status: 'pending', clientId: JAMESTOWN, time: '13:00', type: 'Standard Clean', unit: '69',  roomSize: '1BR', basePrice: 100 },
    { date: WED, status: 'pending', clientId: SUMMIT_401, time: '16:00', type: 'Standard Clean', unit: '3411-106', roomSize: '2BR', basePrice: 120 },
    { date: WED, status: 'pending', clientId: WATERFORD,  time: '16:00', type: 'Standard Clean', unit: '28',       roomSize: '1BR', basePrice: 100 },
  ]

  for (const s of services) {
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   s.date,
        serviceTime:   s.time,
        type:          s.type,
        status:        s.status as any,
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
    console.log(`✓ #${created.serviceNumber}  ${s.date.toISOString().slice(0, 10)} ${s.time}  ${s.unit ?? s.roomSize}  $${s.basePrice}`)
  }

  console.log(`\nAll ${services.length} services created.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
