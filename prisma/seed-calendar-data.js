/**
 * seed-calendar-data.js
 * Imports real service data from the Joyful calendar Excel export.
 * Run: node prisma/seed-calendar-data.js
 */

const xlsx = require('xlsx')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const EXCEL_PATH = 'D:/Proyecto CRM Joyful/Data pasada de servicios del calendario.xlsx'

// ── Management price sheet ─────────────────────────────────────────────────────
const MGMT_PRICES = {
  'Hawthorne':                  { std1BR: 100, std2BR: 120, std3BR: 140, deepCleanFee: 100, hdcFee: 130, office: 195 },
  'Cumberland Towers':          { std1BR: 110, std2BR: 130, std3BR: 150, deepCleanFee: 100, hdcFee: 130, office: 200 },
  'Greystar':                   { std1BR: 90,  std2BR: 120, std3BR: 150, deepCleanFee: 50,  hdcFee: 100, office: 225 },
  'RPN':                        { std1BR: 110, std2BR: 130, std3BR: 150, deepCleanFee: 100, hdcFee: 125, office: 250 },
  'Corporate Living Solutions': { std1BR: 120 },
  'National Corporate Housing': { std1BR: 130, std2BR: 150, cancellationFee: 75, inspectionFee: 75 },
}

// ── Private Customer per-client priceRef ───────────────────────────────────────
const PRIVATE_PRICE_REF = {
  'Amy Cleaning':     { deepCleanMin: 275, deepCleanMax: 1200 },
  'Annette Cleaning': { monthly: 200,      deepCleanMin: 275, deepCleanMax: 1200 },
  'Bill Cleaning':    { monthly: 190,      deepCleanMin: 275, deepCleanMax: 1200 },
  'Franklin Cleaning':{ weekly: 120, biweekly: 210, deepCleanMin: 275, deepCleanMax: 1200 },
  'Heather Cleaning': { biweekly: 200,     deepCleanMin: 275, deepCleanMax: 1200 },
  'Jill Cleaning':    { biweekly: 175,     deepCleanMin: 275, deepCleanMax: 1200 },
  'Michael Cleaning': { monthly: 150,      deepCleanMin: 275, deepCleanMax: 1200 },
  'Molly Realtor':    { deepCleanMin: 275, deepCleanMax: 1200 },
  'Susie Cleaning':   { biweekly: 160,     deepCleanMin: 275, deepCleanMax: 1200 },
}

// ── Default frequency per Private Customer ─────────────────────────────────────
const CLIENT_DEFAULT_FREQ = {
  'Franklin Cleaning': 'weekly',
  'Annette Cleaning':  'monthly',
  'Bill Cleaning':     'monthly',
  'Heather Cleaning':  'biweekly',
  'Jill Cleaning':     'biweekly',
  'Michael Cleaning':  'monthly',
  'Susie Cleaning':    'biweekly',
}

// ── Client name corrections ────────────────────────────────────────────────────
const NAME_FIX = {
  'Soutern Pine Reserve': 'Southern Pines Reserve',
  'the One at Hope Mills': 'The One at Hope Mills',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalizeRoomSize(br) {
  const s = String(br || '').trim()
  if (s === '1BR' || s === '1x1') return '1BR'
  if (s === '2BR' || s === '2x2') return '2BR'
  if (s === '3BR' || s === '3x2') return '3BR'
  return null
}

function mapServiceType(raw) {
  switch (String(raw || '').trim()) {
    case 'Standard Clean':    return 'Standard Clean'
    case 'Deep Clean':        return 'Deep Clean'
    case 'Commercial/Amenity':return 'Office Clean'
    case 'Corporate':         return 'Standard Clean'
    case 'Occupied Clean':    return 'Standard Clean'
    case 'Touch-up':          return 'Touch Up'
    default:                  return 'Standard Clean'
  }
}

function calcPrice(mgmtName, rawType, rawRoomSize) {
  const prices = MGMT_PRICES[mgmtName]
  if (!prices) return { base: 0, fee: 0 }

  const type = mapServiceType(rawType)
  const room = normalizeRoomSize(rawRoomSize)

  if (type === 'Office Clean') {
    return { base: prices.office || 0, fee: 0 }
  }

  if (room) {
    const key = room === '1BR' ? 'std1BR' : room === '2BR' ? 'std2BR' : 'std3BR'
    const base = prices[key] || 0
    if (type === 'Deep Clean') return { base, fee: prices.deepCleanFee || 0 }
    return { base, fee: 0 }
  }

  return { base: 0, fee: 0 }
}

function cleanAddress(raw) {
  return String(raw || '').replace(/\\+/g, '').replace(/\s+/g, ' ').trim()
}

function isCommercial(mgmtName) {
  return mgmtName !== 'Private Customer'
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read Excel
  const wb = xlsx.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const rows = rawRows.slice(2).filter(r => r[0] && r[1]) // skip headers, require # and date
  console.log(`✓ Read ${rows.length} service rows from Excel\n`)

  // 2. Get admin user (created_by_id required on Service)
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) throw new Error('No admin user found in DB')
  console.log(`✓ Admin user: ${admin.name}`)

  // 3. Get managements
  const mgmtList = await prisma.management.findMany()
  const mgmtByName = Object.fromEntries(mgmtList.map(m => [m.name, m.id]))
  console.log(`✓ Managements loaded: ${mgmtList.map(m => m.name).join(', ')}\n`)

  // 4. Delete existing test data (keep users, managements, expenses, payroll)
  console.log('Clearing existing client/service data...')
  await prisma.invoicePayment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.serviceStaff.deleteMany()
  await prisma.servicePhoto.deleteMany()
  await prisma.service.deleteMany()
  await prisma.client.deleteMany()
  console.log('✓ Cleared\n')

  // 5. Build unique client map (best/longest address per client)
  const clientData = {}
  for (const r of rows) {
    const rawName = String(r[9] || '').trim()
    const name = NAME_FIX[rawName] || rawName
    if (!name) continue
    const mgmt = String(r[13] || '').trim() || 'Other'
    const addr = cleanAddress(r[11])
    if (!clientData[name]) {
      clientData[name] = { name, mgmt, address: addr }
    } else if (addr.length > clientData[name].address.length) {
      clientData[name].address = addr
    }
  }

  // 6. Create clients
  console.log(`Creating ${Object.keys(clientData).length} clients...`)
  const clientIds = {} // name → DB id

  for (const info of Object.values(clientData)) {
    const mgmtId = mgmtByName[info.mgmt] || null
    const isPrivate = info.mgmt === 'Private Customer'
    const priceRef = isPrivate ? (PRIVATE_PRICE_REF[info.name] || {}) : undefined
    const frequency = CLIENT_DEFAULT_FREQ[info.name] || (isPrivate ? 'biweekly' : undefined)
    const status = info.name === 'Amy Cleaning' ? 'inactive' : 'active'

    const client = await prisma.client.create({
      data: {
        name: info.name,
        type: isCommercial(info.mgmt) ? 'commercial' : 'residential',
        address: info.address || null,
        status,
        managementId: mgmtId,
        priceRef: priceRef || undefined,
        frequency: frequency || undefined,
      }
    })
    clientIds[info.name] = client.id
    console.log(`  ✓ ${info.name}  [${info.mgmt}]`)
  }

  // 7. Create services
  console.log(`\nCreating services...`)
  const TODAY = new Date('2026-05-29')
  let created = 0
  let skipped = 0

  for (const r of rows) {
    const rawName = String(r[9] || '').trim()
    const clientName = NAME_FIX[rawName] || rawName
    const clientId = clientIds[clientName]
    if (!clientId) { skipped++; continue }

    const mgmtName  = String(r[13] || '').trim()
    const rawType   = String(r[8]  || '').trim()
    const rawRoom   = String(r[7]  || '').trim()
    const dateStr   = String(r[1]  || '').trim()   // YYYY-MM-DD
    const startTime = String(r[3]  || '').trim()   // HH:mm
    const unitDesc  = String(r[6]  || '').trim()
    const notes     = String(r[12] || '').trim()
    const addr      = cleanAddress(r[11])

    if (!dateStr) { skipped++; continue }

    const serviceDate = new Date(dateStr + 'T12:00:00')
    const status = serviceDate < TODAY ? 'completed' : 'pending'
    const mappedType = mapServiceType(rawType)
    const roomSize   = normalizeRoomSize(rawRoom) || (mappedType === 'Office Clean' ? 'Office' : null)
    const { base, fee } = calcPrice(mgmtName, rawType, rawRoom)

    await prisma.service.create({
      data: {
        clientId,
        serviceDate,
        serviceTime: startTime || '08:00',
        type:          mappedType,
        address:       addr || null,
        unit:          unitDesc || null,
        roomSize:      roomSize,
        basePrice:     base,
        additionalFee: fee,
        total:         base + fee,
        status,
        frequency:     'one_time',
        internalNotes: notes || null,
        createdById:   admin.id,
      }
    })

    created++
    if (created % 100 === 0) process.stdout.write(`  ${created} services...\r`)
  }

  console.log(`\n✓ Done!`)
  console.log(`  Clients  : ${Object.keys(clientIds).length}`)
  console.log(`  Services : ${created}`)
  if (skipped > 0) console.log(`  Skipped  : ${skipped}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
