import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JAMESTOWN   = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const SUMMIT_401  = 'e82f4f94-a7c7-44ac-b7de-87af36d45ceb'
const AUSTIN_CREEK = '7c7e843e-b345-42e1-a7a5-1a05294b6eb4'
const CUMBERLAND  = 'bc38f5a2-79bd-4079-8896-fc3c2dab5d1f'
const BUCKHEAD    = 'e3016701-8b4a-4a65-88ad-c7487d425970'
const WEST_END    = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const WATERFORD   = '2b3ce58f-ece1-4e8a-8779-b9807435fc69'
const THE_ONE_FAYE = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const THE_ONE_HOPE = '95c2f15e-a6fb-4f44-b193-53ce668e413f'
const RIM_CREEK   = '56bb6687-b837-4f54-9c35-2ddf922cf21f'
const NCH         = 'cec385b5-d1b5-4c68-8f43-befeea83c764'
const FRANKLIN    = 'bca12fdc-73e3-411a-9658-90317c69223a'

const ADDR: Record<string, string> = {
  [JAMESTOWN]:    '1429 Bozeman Loop, Fayetteville, NC 28303',
  [SUMMIT_401]:   '3325 Oak Forest Dr',
  [AUSTIN_CREEK]: '1131 Capeharbor Ct, Fayetteville, NC 28314',
  [CUMBERLAND]:   '2580 Cumberland Creek Dr',
  [BUCKHEAD]:     '4428 Kinkead Ct, Fayetteville, NC 28314',
  [WEST_END]:     '3050 Plantation Garden Blvd',
  [WATERFORD]:    '801 Shell Dr, Spring Lake, NC 28390',
  [THE_ONE_FAYE]: '3010 Valentina Way, Fayetteville, NC 28314',
  [THE_ONE_HOPE]: '3680 Elk Rd, Hope Mills, NC 28348',
  [RIM_CREEK]:    '4811 Cellner Dr, Fayetteville, NC 28314',
  [NCH]:          '3050 Plantation Garden Blvd, Fayetteville, NC 28303',
  [FRANKLIN]:     '3649 Glenbarry Cir, Fayetteville, NC 28311',
}

const STAFF_NAMES = ['Taymie Diaz', 'Jenifer Dubon', 'Lizyanis Alvarez Aguirre (Liz)', 'Melsy Barrera Franco (Aracelis)', 'Nathasha Salcedo']

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin', name: 'Admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)

  const staffUsers = await prisma.user.findMany({ where: { name: { in: STAFF_NAMES } }, select: { id: true, name: true } })
  if (staffUsers.length !== STAFF_NAMES.length) {
    throw new Error(`Expected ${STAFF_NAMES.length} staff users, found ${staffUsers.length}: ${staffUsers.map(u => u.name).join(', ')}`)
  }
  console.log('Staff:', staffUsers.map(u => u.name).join(', '))

  const TUE = new Date('2026-06-16T12:00:00.000Z')
  const WED = new Date('2026-06-17T12:00:00.000Z')
  const THU = new Date('2026-06-18T12:00:00.000Z')
  const FRI = new Date('2026-06-19T12:00:00.000Z')

  const services = [
    // ── Tuesday Jun 16 ──
    { date: TUE, clientId: JAMESTOWN,   time: '08:00', type: 'Standard Clean',    unit: 'Clubhouse/fitness/pool Bathrooms', roomSize: 'Office/Amenities', basePrice: 225, additionalFee: 0 },
    { date: TUE, clientId: SUMMIT_401,  time: '09:30', type: 'Standard Clean',    unit: 'Office/Gym/bathrooms',             roomSize: 'Office/Amenities', basePrice: 225, additionalFee: 0 },
    { date: TUE, clientId: SUMMIT_401,  time: '10:30', type: 'Cancellation Fee',  unit: '3561-205', roomSize: '3BR', basePrice: 75,  additionalFee: 0 },
    { date: TUE, clientId: SUMMIT_401,  time: '10:30', type: 'Cancellation Fee',  unit: '3451-306', roomSize: '2BR', basePrice: 75,  additionalFee: 0 },
    { date: TUE, clientId: AUSTIN_CREEK, time: '10:40', type: 'Standard Clean',   unit: '3',        roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: TUE, clientId: CUMBERLAND,  time: '13:10', type: 'Deep Clean',       unit: '2311-104', roomSize: '1BR', basePrice: 110, additionalFee: 100 },
    { date: TUE, clientId: BUCKHEAD,    time: '14:30', type: 'Deep Clean',       unit: '60',       roomSize: '1BR', basePrice: 100, additionalFee: 100 },
    { date: TUE, clientId: NCH,         time: '16:00', type: 'Standard Clean',   unit: '3134-201 (West End)', roomSize: '1BR', basePrice: 130, additionalFee: 0, numericKey: '7331' },

    // ── Wednesday Jun 17 ── ("Jeni medio dia" all-day note skipped — not a billable service)
    { date: WED, clientId: WEST_END,    time: '08:00', type: 'Standard Clean',    unit: 'Office/Amenities',  roomSize: 'Office/Amenities', basePrice: 195, additionalFee: 0 },
    { date: WED, clientId: WATERFORD,   time: '09:30', type: 'Standard Clean',    unit: '24',  roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: WED, clientId: WATERFORD,   time: '10:30', type: 'Standard Clean',    unit: '81',  roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: WED, clientId: WATERFORD,   time: '11:30', type: 'Standard Clean',    unit: '242', roomSize: '1BR', basePrice: 100, additionalFee: 0 },
    { date: WED, clientId: FRANKLIN,    time: '13:30', type: 'Standard Clean',    unit: 'Bathrooms Cleaning', roomSize: 'Other', basePrice: 120, additionalFee: 0 },
    { date: WED, clientId: CUMBERLAND,  time: '14:45', type: 'Standard Clean',    unit: '2354-104', roomSize: '2BR', basePrice: 130, additionalFee: 0 },

    // ── Thursday Jun 18 ──
    { date: THU, clientId: THE_ONE_FAYE, time: '08:00', type: 'Standard Clean',   unit: 'Office/Amenities', roomSize: 'Office/Amenities', basePrice: 195, additionalFee: 0 },
    { date: THU, clientId: THE_ONE_FAYE, time: '09:15', type: 'Standard Clean',   unit: '3070-107', roomSize: 'Modelo', basePrice: 100, additionalFee: 0 },
    { date: THU, clientId: AUSTIN_CREEK, time: '10:35', type: 'Standard Clean',   unit: '73', roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: THU, clientId: AUSTIN_CREEK, time: '11:15', type: 'Standard Clean',   unit: '44', roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: THU, clientId: SUMMIT_401,   time: '13:00', type: 'Heavy Deep Clean', unit: '3551-205', roomSize: '3BR', basePrice: 150, additionalFee: 100 },
    { date: THU, clientId: SUMMIT_401,   time: '15:00', type: 'Heavy Deep Clean', unit: '3421-306', roomSize: '2BR', basePrice: 120, additionalFee: 100 },

    // ── Friday Jun 19 ──
    { date: FRI, clientId: THE_ONE_HOPE, time: '08:00', type: 'Standard Clean', unit: 'Office/Amenities', roomSize: 'Office/Amenities', basePrice: 195, additionalFee: 0 },
    { date: FRI, clientId: THE_ONE_HOPE, time: '09:55', type: 'Standard Clean', unit: '1085-103', roomSize: '2x2', basePrice: 120, additionalFee: 0 },
    { date: FRI, clientId: RIM_CREEK,    time: '12:45', type: 'Deep Clean',     unit: '4860-I',   roomSize: '2BR', basePrice: 120, additionalFee: 100 },
    { date: FRI, clientId: THE_ONE_FAYE, time: '14:30', type: 'Standard Clean', unit: '3060-301', roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: FRI, clientId: THE_ONE_FAYE, time: '15:00', type: 'Standard Clean', unit: '3055-108', roomSize: '2BR', basePrice: 120, additionalFee: 0 },
    { date: FRI, clientId: WEST_END,     time: '16:25', type: 'Standard Clean', unit: '3124-202', roomSize: '3BR', basePrice: 140, additionalFee: 0 },
  ]

  for (const s of services) {
    const total = s.basePrice + s.additionalFee
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   s.date,
        serviceTime:   s.time,
        type:          s.type,
        status:        'completed',
        address:       ADDR[s.clientId],
        unit:          s.unit ?? null,
        numericKey:    (s as any).numericKey ?? null,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: s.additionalFee,
        total,
        frequency:     'one_time',
      },
      select: { id: true, serviceNumber: true },
    })

    await prisma.serviceStaff.createMany({
      data: staffUsers.map(u => ({ serviceId: created.id, userId: u.id })),
    })

    console.log(`✓ #${created.serviceNumber}  ${s.date.toISOString().slice(0, 10)} ${s.time}  ${s.unit ?? s.roomSize}  $${total}`)
  }

  console.log(`\nAll ${services.length} services created, each with ${staffUsers.length} staff assigned.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
