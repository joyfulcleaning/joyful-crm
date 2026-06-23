import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Imported from joyful_eventos_futuros_clean.ics — only events with serviceDate >= 2026-06-29.
// status pending, no staff assigned. Prices from Management.priceConditions (std1BR/std2BR/std3BR/office)
// and Client.priceRef (private customers). 0 where no matching price-table field exists.
// Excluded: "Bristol Park" 2026-07-02 (no matching client in DB — reported separately, not created),
// "Jeni off" 2026-07-15 (staff day-off note, not a cleaning service).
// "Upstairs dusting Mrs Franklin" is a monthly (1st Wednesday) recurring master with no fixed end date;
// per instruction, generated the 8/5 and 9/2 occurrences in addition to the 7/1 override already in the file.

const JAMESTOWN     = '19b5d837-fc16-462b-9c7e-ae562c806a3b'
const THE_ONE_FAYE  = 'f939a8d5-a105-473b-bfb1-d70afc54d472'
const WEST_END      = '1a676856-c362-418d-a65b-529a3b6b5fd5'
const SOUTH_MAIN    = '572f36eb-ffe8-4380-b632-621e7a41094e'
const BUCKHEAD      = 'e3016701-8b4a-4a65-88ad-c7487d425970'
const AUSTIN_CREEK  = '7c7e843e-b345-42e1-a7a5-1a05294b6eb4'
const SUMMIT_401    = 'e82f4f94-a7c7-44ac-b7de-87af36d45ceb'
const HOPE_MILLS    = '95c2f15e-a6fb-4f44-b193-53ce668e413f'
const WATERFORD     = '2b3ce58f-ece1-4e8a-8779-b9807435fc69'
const KAREN_LAKE    = 'b39457c9-d7e8-454b-a314-1309e1132b44'
const VILLAGE_CHASE = 'd1b4aace-6688-4de9-9744-a8919c8fab28'
const RIM_CREEK     = '56bb6687-b837-4f54-9c35-2ddf922cf21f'
const FRANKLIN      = 'bca12fdc-73e3-411a-9658-90317c69223a'
const WAYSIDE       = '7c9f5426-5c4c-4770-bfa6-da43efc5dd49'

const ADDR: Record<string, string | null> = {
  [JAMESTOWN]:     '1429 Bozeman Loop, Fayetteville, NC 28303',
  [THE_ONE_FAYE]:  '3010 Valentina Way, Fayetteville, NC 28314',
  [WEST_END]:      '3050 Plantation Garden Blvd',
  [SOUTH_MAIN]:    '4003 William M Bill Luther St, Hope Mills, NC 28348',
  [BUCKHEAD]:      '4428 Kinkead Ct, Fayetteville, NC 28314',
  [AUSTIN_CREEK]:  '1131 Capeharbor Ct, Fayetteville, NC 28314',
  [SUMMIT_401]:    '3325 Oak Forest Dr',
  [HOPE_MILLS]:    '3680 Elk Rd, Hope Mills, NC 28348',
  [WATERFORD]:     '801 Shell Dr, Spring Lake, NC 28390',
  [KAREN_LAKE]:    '3605 Sapphire Dr',
  [VILLAGE_CHASE]: '2737 Kentberry Ave, Fayetteville, NC 28301',
  [RIM_CREEK]:     '4811 Cellner Dr, Fayetteville, NC 28314',
  [FRANKLIN]:      '3649 Glenbarry Cir, Fayetteville, NC 28311',
  [WAYSIDE]:       null,
}

function d(s: string) { return new Date(`${s}T12:00:00.000Z`) }

const services = [
  { date: d('2026-06-29'), clientId: JAMESTOWN,     time: '17:00', type: 'Standard Clean', unit: '28',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-06-30'), clientId: JAMESTOWN,     time: '09:00', type: 'Standard Clean', unit: '147',            roomSize: 'Modelo', basePrice: 0,  notes: 'llave en la oficina' },
  { date: d('2026-06-30'), clientId: THE_ONE_FAYE,  time: '10:00', type: 'Standard Clean', unit: '3055-207',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-01'), clientId: FRANKLIN,      time: '13:00', type: 'Standard Clean', unit: 'Upstairs Dusting/Bathrooms', roomSize: 'Other', basePrice: 0, notes: 'Recurrente mensual (1er miércoles). Histórico más reciente de esta misma tarea: $210 — no hay campo en la tabla de precios para este tipo de trabajo.' },
  { date: d('2026-07-01'), clientId: SOUTH_MAIN,    time: '17:15', type: 'Standard Clean', unit: 'Apt 3',          roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-02'), clientId: BUCKHEAD,      time: '12:00', type: 'Standard Clean', unit: 'Apt 56',         roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-02'), clientId: WEST_END,      time: '18:00', type: 'Standard Clean', unit: '851-303',        roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-02'), clientId: WEST_END,      time: '18:00', type: 'Standard Clean', unit: '3120-106',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-03'), clientId: SOUTH_MAIN,    time: '10:00', type: 'Standard Clean', unit: '12',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-03'), clientId: THE_ONE_FAYE,  time: '13:20', type: 'Standard Clean', unit: '3025-208',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-03'), clientId: AUSTIN_CREEK,  time: '14:10', type: 'Standard Clean', unit: 'Apt 82',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-03'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3611-103',       roomSize: '1BR',   basePrice: 90,  notes: null },
  { date: d('2026-07-03'), clientId: JAMESTOWN,     time: '17:00', type: 'Standard Clean', unit: '150',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-06'), clientId: JAMESTOWN,     time: '16:00', type: 'Standard Clean', unit: '102',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-06'), clientId: JAMESTOWN,     time: '16:00', type: 'Standard Clean', unit: '168',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-06'), clientId: THE_ONE_FAYE,  time: '17:00', type: 'Standard Clean', unit: '3055-202',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-07'), clientId: AUSTIN_CREEK,  time: '14:10', type: 'Standard Clean', unit: 'Apt 03',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-07'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3451-205',       roomSize: '3BR',   basePrice: 150, notes: null },
  { date: d('2026-07-07'), clientId: THE_ONE_FAYE,  time: '15:30', type: 'Standard Clean', unit: '3040-306',       roomSize: '1x1',   basePrice: 100, notes: null },
  { date: d('2026-07-07'), clientId: THE_ONE_FAYE,  time: '15:30', type: 'Standard Clean', unit: '3071-104',       roomSize: '1x1',   basePrice: 100, notes: null },
  { date: d('2026-07-07'), clientId: JAMESTOWN,     time: '17:00', type: 'Standard Clean', unit: '190',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-08'), clientId: HOPE_MILLS,    time: '11:00', type: 'Standard Clean', unit: '1085-305',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-08'), clientId: WEST_END,      time: '11:20', type: 'Standard Clean', unit: '851-102',        roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-07-08'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3430-101',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-08'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3430-303',       roomSize: '1BR',   basePrice: 90,  notes: null },
  { date: d('2026-07-08'), clientId: JAMESTOWN,     time: '16:00', type: 'Standard Clean', unit: '208',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-09'), clientId: JAMESTOWN,     time: '12:00', type: 'Standard Clean', unit: '34',             roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-07-09'), clientId: THE_ONE_FAYE,  time: '12:00', type: 'Standard Clean', unit: '3070-104',       roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-09'), clientId: AUSTIN_CREEK,  time: '14:00', type: 'Standard Clean', unit: 'Apt 06',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-09'), clientId: WATERFORD,     time: '15:00', type: 'Standard Clean', unit: '248',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-09'), clientId: WATERFORD,     time: '15:00', type: 'Standard Clean', unit: '129',            roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-09'), clientId: KAREN_LAKE,    time: '15:15', type: 'Standard Clean', unit: '3720-4',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-10'), clientId: WEST_END,      time: '10:15', type: 'Standard Clean', unit: '859-302',        roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-07-10'), clientId: THE_ONE_FAYE,  time: '11:45', type: 'Standard Clean', unit: '3040-307',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-07-10'), clientId: WEST_END,      time: '14:30', type: 'Standard Clean', unit: '3135-108',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-10'), clientId: JAMESTOWN,     time: '17:00', type: 'Standard Clean', unit: '145',            roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-10'), clientId: JAMESTOWN,     time: '17:00', type: 'Standard Clean', unit: '94',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-13'), clientId: THE_ONE_FAYE,  time: '11:00', type: 'Standard Clean', unit: '3045-201',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-07-13'), clientId: KAREN_LAKE,    time: '17:00', type: 'Standard Clean', unit: '3705-1',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-13'), clientId: KAREN_LAKE,    time: '17:00', type: 'Standard Clean', unit: '3720-2',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-14'), clientId: SOUTH_MAIN,    time: '10:00', type: 'Standard Clean', unit: '21',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-14'), clientId: THE_ONE_FAYE,  time: '10:00', type: 'Standard Clean', unit: '3020-101',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-14'), clientId: HOPE_MILLS,    time: '12:00', type: 'Standard Clean', unit: '2811-101',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-15'), clientId: WATERFORD,     time: '15:00', type: 'Standard Clean', unit: '34',             roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-15'), clientId: WATERFORD,     time: '15:00', type: 'Standard Clean', unit: '49',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-15'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3621-303',       roomSize: '1BR',   basePrice: 90,  notes: null },
  { date: d('2026-07-16'), clientId: BUCKHEAD,      time: '12:00', type: 'Standard Clean', unit: 'Apt 24',         roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-17'), clientId: WEST_END,      time: '10:00', type: 'Standard Clean', unit: '1170-102',       roomSize: '3BR',   basePrice: 140, notes: 'Evento de todo el día en el calendario (sin hora específica) — hora 10:00 asignada como placeholder.' },
  { date: d('2026-07-20'), clientId: THE_ONE_FAYE,  time: '13:45', type: 'Standard Clean', unit: '3071-105',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-20'), clientId: JAMESTOWN,     time: '15:00', type: 'Standard Clean', unit: '126',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-21'), clientId: THE_ONE_FAYE,  time: '14:30', type: 'Standard Clean', unit: '3040-104',       roomSize: '1x1',   basePrice: 100, notes: null },
  { date: d('2026-07-21'), clientId: VILLAGE_CHASE, time: '15:30', type: 'Standard Clean', unit: '1523-3',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-22'), clientId: THE_ONE_FAYE,  time: '11:30', type: 'Standard Clean', unit: '3011-105',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-22'), clientId: JAMESTOWN,     time: '12:00', type: 'Standard Clean', unit: '189',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-22'), clientId: THE_ONE_FAYE,  time: '12:00', type: 'Standard Clean', unit: '3071-304',       roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-07-23'), clientId: VILLAGE_CHASE, time: '14:00', type: 'Standard Clean', unit: '1511-4',         roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-23'), clientId: RIM_CREEK,     time: '15:50', type: 'Standard Clean', unit: '4870-B',         roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-07-24'), clientId: WEST_END,      time: '18:00', type: 'Standard Clean', unit: '3124-302',       roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-07-29'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3421-302',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-07-30'), clientId: WAYSIDE,       time: '12:00', type: 'Standard Clean', unit: '106 Dotson Dr, Raeford, NC', roomSize: '2BR', basePrice: 120, notes: null },
  { date: d('2026-07-31'), clientId: THE_ONE_FAYE,  time: '10:05', type: 'Standard Clean', unit: '3070-301',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-08-03'), clientId: THE_ONE_FAYE,  time: '10:45', type: 'Standard Clean', unit: '3045-202',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-08-03'), clientId: JAMESTOWN,     time: '15:00', type: 'Standard Clean', unit: '73',             roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-03'), clientId: WEST_END,      time: '18:00', type: 'Standard Clean', unit: '854-305',        roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-04'), clientId: THE_ONE_FAYE,  time: '13:00', type: 'Standard Clean', unit: '3040-303',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-05'), clientId: HOPE_MILLS,    time: '13:00', type: 'Standard Clean', unit: '1065-302',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-05'), clientId: VILLAGE_CHASE, time: '14:00', type: 'Standard Clean', unit: '2711-11',        roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-05'), clientId: SUMMIT_401,    time: '15:00', type: 'Standard Clean', unit: '3421-203',       roomSize: '1BR',   basePrice: 90,  notes: null },
  { date: d('2026-08-05'), clientId: FRANKLIN,      time: '12:00', type: 'Standard Clean', unit: 'Upstairs Dusting/Bathrooms', roomSize: 'Other', basePrice: 0, notes: 'Recurrente mensual (1er miércoles) — generado sin instancia explícita en el calendario (la serie es indefinida).' },
  { date: d('2026-08-06'), clientId: THE_ONE_FAYE,  time: '12:30', type: 'Standard Clean', unit: '3071-301',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-07'), clientId: THE_ONE_FAYE,  time: '13:45', type: 'Standard Clean', unit: '3010-308',       roomSize: '3x2',   basePrice: 140, notes: null },
  { date: d('2026-08-07'), clientId: WATERFORD,     time: '15:00', type: 'Standard Clean', unit: '126',            roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-08-10'), clientId: WEST_END,      time: '10:15', type: 'Standard Clean', unit: '3120-301',       roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-08-10'), clientId: THE_ONE_FAYE,  time: '15:25', type: 'Standard Clean', unit: '3071-307',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-08-12'), clientId: THE_ONE_FAYE,  time: '15:20', type: 'Standard Clean', unit: '3025-201',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-17'), clientId: THE_ONE_FAYE,  time: '13:45', type: 'Standard Clean', unit: '3045-302',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-17'), clientId: THE_ONE_FAYE,  time: '15:00', type: 'Standard Clean', unit: '3020-103',       roomSize: '2x2',   basePrice: 120, notes: null },
  { date: d('2026-08-18'), clientId: THE_ONE_FAYE,  time: '17:00', type: 'Standard Clean', unit: '3060-102',       roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-08-19'), clientId: THE_ONE_FAYE,  time: '10:30', type: 'Standard Clean', unit: '3025-102',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-24'), clientId: THE_ONE_FAYE,  time: '13:00', type: 'Standard Clean', unit: '3055-107',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-08-31'), clientId: THE_ONE_FAYE,  time: '13:10', type: 'Standard Clean', unit: '3045-303',       roomSize: '1x1',   basePrice: 100, notes: null },
  { date: d('2026-09-01'), clientId: JAMESTOWN,     time: '15:00', type: 'Standard Clean', unit: '186',            roomSize: '3BR',   basePrice: 140, notes: null },
  { date: d('2026-09-02'), clientId: FRANKLIN,      time: '12:00', type: 'Standard Clean', unit: 'Upstairs Dusting/Bathrooms', roomSize: 'Other', basePrice: 0, notes: 'Recurrente mensual (1er miércoles) — generado sin instancia explícita en el calendario (la serie es indefinida).' },
  { date: d('2026-09-02'), clientId: THE_ONE_FAYE,  time: '12:40', type: 'Standard Clean', unit: '3035-107',       roomSize: '2BR',   basePrice: 120, notes: null },
  { date: d('2026-09-03'), clientId: THE_ONE_FAYE,  time: '10:00', type: 'Standard Clean', unit: '3025-305',       roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-09-04'), clientId: THE_ONE_FAYE,  time: '10:55', type: 'Standard Clean', unit: '3025-205',       roomSize: '1BR',   basePrice: 100, notes: null },
  { date: d('2026-09-04'), clientId: THE_ONE_FAYE,  time: '11:40', type: 'Standard Clean', unit: '3070-108',       roomSize: '2BR',   basePrice: 120, notes: null },
]

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin', name: 'Admin' }, select: { id: true, name: true } })
  if (!admin) throw new Error('No admin user found')
  console.log('Using admin:', admin.name, admin.id)
  console.log(`Creating ${services.length} services...\n`)

  for (const s of services) {
    const created = await prisma.service.create({
      data: {
        client:        { connect: { id: s.clientId } },
        createdBy:     { connect: { id: admin.id } },
        serviceDate:   s.date,
        serviceTime:   s.time,
        type:          s.type,
        status:        'pending',
        address:       ADDR[s.clientId] ?? null,
        unit:          s.unit,
        roomSize:      s.roomSize,
        basePrice:     s.basePrice,
        additionalFee: 0,
        total:         s.basePrice,
        internalNotes: s.notes,
        frequency:     'one_time',
      },
      select: { id: true, serviceNumber: true },
    })
    console.log(`✓ #${created.serviceNumber}  ${s.date.toISOString().slice(0, 10)} ${s.time}  ${s.unit}  $${s.basePrice}`)
  }

  console.log(`\nAll ${services.length} services created (pending, no staff, prices from management/client price tables).`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
