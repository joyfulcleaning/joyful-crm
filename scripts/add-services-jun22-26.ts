import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Imported from joyful_esta_semana.ics — status pending, no staff assigned, no prices set.
// Staff and prices to be filled in later via the Services UI.

const SUMMIT_401     = 'e82f4f94-a7c7-44ac-b7de-87af36d45ceb'
const THE_ONE_FAYE   = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const WEST_END       = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const SOUTH_MAIN     = '572f36eb-ffe8-4380-b632-621e7a41094e'
const JAMESTOWN      = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const RIM_CREEK      = '56bb6687-b837-4f54-9c35-2ddf922cf21f'
const CUMBERLAND     = 'bc38f5a2-79bd-4079-8896-fc3c2dab5d1f'
const WATERFORD      = '2b3ce58f-ece1-4e8a-8779-b9807435fc69'
const SOUTHERN_PINES = '49e877a0-39fa-49e6-8c82-d9152c0c130d'
const JILL           = 'c63249dd-3bb7-4cb8-ab19-c1f46884931e'
const SUSIE          = '8b76dff3-60ba-47a5-9d3f-1228abf8134d'

const ADDR: Record<string, string> = {
  [SUMMIT_401]:     '3325 Oak Forest Dr',
  [THE_ONE_FAYE]:   '3010 Valentina Way, Fayetteville, NC 28314',
  [WEST_END]:       '3050 Plantation Garden Blvd',
  [SOUTH_MAIN]:     '4003 William M Bill Luther St, Hope Mills, NC 28348',
  [JAMESTOWN]:      '1429 Bozeman Loop, Fayetteville, NC 28303',
  [RIM_CREEK]:      '4811 Cellner Dr, Fayetteville, NC 28314',
  [CUMBERLAND]:     '2580 Cumberland Creek Dr',
  [WATERFORD]:      '801 Shell Dr, Spring Lake, NC 28390',
  [SOUTHERN_PINES]: '800 Churchill Downs Dr',
  [JILL]:           '52 Hunters Ridge Trail Dunn, NC 28334 United States',
  [SUSIE]:          '270 Mckenzie Rd W Pinehurst, NC, United States',
}

const MON = new Date('2026-06-22T12:00:00.000Z')
const TUE = new Date('2026-06-23T12:00:00.000Z')
const WED = new Date('2026-06-24T12:00:00.000Z')
const THU = new Date('2026-06-25T12:00:00.000Z')
const FRI = new Date('2026-06-26T12:00:00.000Z')

// Prices pulled from Management.priceConditions (std1BR/std2BR/std3BR/office) and
// Client.priceRef (private customers' flat biweekly rate). 0 where no matching
// price-table field exists (touchUp is inactive for every management on this list,
// and "Solo la nevera" has no equivalent field).
const services = [
  // ── Monday Jun 22 ──
  { date: MON, clientId: SUSIE,          time: '09:15', type: 'Standard Clean', unit: null,              roomSize: null,               internalNotes: 'habitado',      basePrice: 160 },
  { date: MON, clientId: SOUTHERN_PINES, time: '10:30', type: 'Standard Clean', unit: 'Office/Amenities', roomSize: 'Office/Amenities', internalNotes: null,            basePrice: 250 },
  { date: MON, clientId: SOUTHERN_PINES, time: '11:30', type: 'Other',          unit: '403',              roomSize: null,               internalNotes: 'Solo la nevera', basePrice: 0 },
  { date: MON, clientId: SOUTHERN_PINES, time: '11:30', type: 'Standard Clean', unit: '1606',             roomSize: '3BR',              internalNotes: null,            basePrice: 150 },
  { date: MON, clientId: THE_ONE_FAYE,   time: '14:00', type: 'Standard Clean', unit: '3025-107',         roomSize: '2BR',              internalNotes: null,            basePrice: 120 },
  { date: MON, clientId: THE_ONE_FAYE,   time: '15:00', type: 'Standard Clean', unit: '3045-102',         roomSize: '2BR',              internalNotes: null,            basePrice: 120 },

  // ── Tuesday Jun 23 ──
  { date: TUE, clientId: JILL,           time: '08:30', type: 'Standard Clean', unit: null,                       roomSize: null,               internalNotes: 'habitada', basePrice: 175 },
  { date: TUE, clientId: WATERFORD,      time: '10:00', type: 'Standard Clean', unit: 'Office/Amenities/Modelo',  roomSize: 'Office/Amenities', internalNotes: null,       basePrice: 195 },
  { date: TUE, clientId: WATERFORD,      time: '11:00', type: 'Standard Clean', unit: '153',                      roomSize: '2BR',              internalNotes: null,       basePrice: 120 },
  { date: TUE, clientId: WATERFORD,      time: '13:00', type: 'Standard Clean', unit: '78',                       roomSize: '1BR',              internalNotes: null,       basePrice: 100 },
  { date: TUE, clientId: THE_ONE_FAYE,   time: '15:00', type: 'Standard Clean', unit: '3025-304',                 roomSize: '1BR',              internalNotes: null,       basePrice: 100 },
  { date: TUE, clientId: SOUTH_MAIN,     time: '15:05', type: 'Touch Up',       unit: 'Apt 9',                    roomSize: '1BR',              internalNotes: null,       basePrice: 0 },

  // ── Wednesday Jun 24 ──
  { date: WED, clientId: THE_ONE_FAYE, time: '12:00', type: 'Standard Clean', unit: '3011-303', roomSize: '2BR', internalNotes: null, basePrice: 120 },
  { date: WED, clientId: THE_ONE_FAYE, time: '13:00', type: 'Standard Clean', unit: '3071-204', roomSize: '1BR', internalNotes: null, basePrice: 100 },
  { date: WED, clientId: CUMBERLAND,   time: '14:30', type: 'Standard Clean', unit: '2557-103', roomSize: '2BR', internalNotes: null, basePrice: 130 },
  { date: WED, clientId: CUMBERLAND,   time: '14:30', type: 'Standard Clean', unit: '2550-105', roomSize: '1BR', internalNotes: null, basePrice: 110 },

  // ── Thursday Jun 25 ──
  { date: THU, clientId: RIM_CREEK,  time: '11:00', type: 'Standard Clean', unit: '4860-D',   roomSize: '2BR', internalNotes: null,   basePrice: 120 },
  { date: THU, clientId: JAMESTOWN,  time: '12:00', type: 'Standard Clean', unit: '30',       roomSize: '1BR', internalNotes: null,   basePrice: 100 },
  { date: THU, clientId: SUMMIT_401, time: '13:00', type: 'Standard Clean', unit: '3551-305', roomSize: '3BR', internalNotes: null,   basePrice: 150 },
  { date: THU, clientId: SUMMIT_401, time: '15:00', type: 'Standard Clean', unit: '3421-103', roomSize: '1BR', internalNotes: 'reno', basePrice: 90 },
  { date: THU, clientId: WEST_END,   time: '18:00', type: 'Standard Clean', unit: '1090-207', roomSize: '3BR', internalNotes: null,   basePrice: 140 },
  { date: THU, clientId: WEST_END,   time: '18:00', type: 'Standard Clean', unit: '1170-303', roomSize: '2BR', internalNotes: null,   basePrice: 120 },

  // ── Friday Jun 26 ──
  { date: FRI, clientId: WEST_END,     time: '13:00', type: 'Touch Up',       unit: '855-204',  roomSize: '2BR', internalNotes: null, basePrice: 0 },
  { date: FRI, clientId: WEST_END,     time: '13:00', type: 'Touch Up',       unit: '855-208',  roomSize: '2BR', internalNotes: null, basePrice: 0 },
  { date: FRI, clientId: THE_ONE_FAYE, time: '14:00', type: 'Standard Clean', unit: '3025-303', roomSize: '1BR', internalNotes: null, basePrice: 100 },
  { date: FRI, clientId: SUMMIT_401,   time: '15:00', type: 'Standard Clean', unit: '3611-305', roomSize: '3BR', internalNotes: null, basePrice: 150 },
]

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin', name: 'Admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)

  for (const s of services) {
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   s.date,
        serviceTime:   s.time,
        type:          s.type,
        status:        'pending',
        address:       ADDR[s.clientId],
        unit:          s.unit,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: 0,
        total:         s.basePrice,
        internalNotes: s.internalNotes,
        frequency:     'one_time',
      },
      select: { id: true, serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  ${s.date.toISOString().slice(0, 10)} ${s.time}  ${s.unit ?? s.roomSize ?? s.internalNotes}  $${s.basePrice}`)
  }

  console.log(`\nAll ${services.length} services created (pending, no staff, prices from management/client price tables).`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
