/**
 * seed-demo-data.js
 * Adds demo services, invoices and expenses for presentation purposes.
 * Uses existing real clients — does NOT delete them.
 * Run: node prisma/seed-demo-data.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ── Helpers ────────────────────────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickN(arr, n) {
  const copy = [...arr]; const out = []
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(i, 1)[0])
  }
  return out
}

// ── Date utilities ─────────────────────────────────────────────────────────────
function getWorkdays(startStr, endStr) {
  const days = [], cur = new Date(startStr + 'T12:00:00')
  const end  = new Date(endStr   + 'T12:00:00')
  while (cur <= end) {
    const d = cur.getDay()
    if (d >= 1 && d <= 5) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}

// ── Management prices ──────────────────────────────────────────────────────────
const PRICES = {
  'Hawthorne':                  { std1BR:100, std2BR:120, std3BR:140, dcFee:100, hdcFee:130, office:195, office2:225 },
  'Cumberland Towers':          { std1BR:110, std2BR:130, std3BR:150, dcFee:100, hdcFee:130, office:200 },
  'Greystar':                   { std1BR:90,  std2BR:120, std3BR:150, dcFee:50,  hdcFee:100, office:225  },
  'RPN':                        { std1BR:110, std2BR:130, std3BR:150, dcFee:100, hdcFee:125, office:250  },
  'Corporate Living Solutions': { std1BR:120 },
  'National Corporate Housing': { std1BR:130, std2BR:150 },
  'Private Customer':           {},
  'Other':                      {},
}

// Private customer base price per visit (weekly / biweekly / monthly)
// Keys match the frequency assigned in seed-calendar-data.js CLIENT_DEFAULT_FREQ
const PRIVATE_BASE = {
  'Franklin Cleaning':  120,  // weekly $120 / biweekly $210 — most visits are weekly
  'Annette Cleaning':   200,  // monthly
  'Bill Cleaning':      190,  // monthly
  'Heather Cleaning':   200,  // biweekly
  'Jill Cleaning':      175,  // biweekly
  'Michael Cleaning':   150,  // monthly
  'Susie Cleaning':     160,  // biweekly
  'Molly Realtor':      350,  // deep clean / realtor job
  'Other':              150,
}

// ── Room size pools per management ─────────────────────────────────────────────
const ROOM_POOL = {
  'Hawthorne':                  ['1BR','1BR','2BR','2BR','2BR','3BR'],
  'Cumberland Towers':          ['1BR','2BR','2BR','3BR','3BR'],
  'Greystar':                   ['1BR','1BR','2BR','2BR','3BR'],
  'RPN':                        ['1BR','2BR','2BR','3BR'],
  'Corporate Living Solutions': ['2BR','2BR','2BR'],
  'National Corporate Housing': ['1BR','2BR','2BR'],
}

// ── Service type pools per client category ─────────────────────────────────────
const COMMERCIAL_TYPES = [
  'Standard Clean','Standard Clean','Standard Clean','Standard Clean',
  'Standard Clean','Standard Clean','Standard Clean',
  'Deep Clean','Deep Clean',
  'Office Clean',
]
const PRIVATE_TYPES = [
  'Standard Clean','Standard Clean','Standard Clean','Standard Clean',
  'Standard Clean','Standard Clean',
  'Deep Clean','Deep Clean',
  'Touch Up',
]
const OFFICE_CLIENT_TYPES = [
  'Office Clean','Office Clean','Office Clean',
  'Standard Clean','Standard Clean',
  'Deep Clean',
]

// ── Payment method pools ───────────────────────────────────────────────────────
const PAY_COMMERCIAL = ['check','check','check','ach','ach','zelle']
const PAY_PRIVATE    = ['zelle','zelle','zelle','cash','cash','venmo','cashapp']
const PAY_CORPORATE  = ['ach','ach','check']
const PAY_NCH        = ['check','check','ach']

// ── Unit number generator ──────────────────────────────────────────────────────
const FLOORS = [1,2,3,4]
function randomUnit() {
  const floor = pick(FLOORS)
  const unit  = rnd(1, 20)
  return `${floor}${String(unit).padStart(2,'0')}`
}

// ── Notes pools ────────────────────────────────────────────────────────────────
const INT_NOTES = [
  '','','','','','','', // mostly empty
  'Client requested extra attention to kitchen.',
  'Move-out cleaning — unit must be spotless.',
  'Tenant complained about previous visit, extra care needed.',
  'First visit to this unit.',
  'AC filter changed by maintenance today.',
  'Unit has a dog, client will put him away.',
]
const STAFF_NOTES_POOL = [
  '','','','','',
  'Ring doorbell twice.',
  'Park in visitor spot.',
  'Key is at the office.',
  'Bring extra bathroom supplies.',
  'Client prefers eco-friendly products.',
]

// ── Client schedule weights ────────────────────────────────────────────────────
const CLIENT_WEIGHTS = {
  'West End at Fayetteville':        9,
  'The One at Fayetteville':          9,
  'Summit at 401':                    8,
  'Cumberland Towers Apts':           7,
  'Southern Pines Reserve':           7,
  'South Pointe at Wayside':          6,
  'Jamestown':                        5,
  'Waterford':                        5,
  'Rim Creek Apts':                   4,
  'South Main Apartments':            4,
  'Village Chase Apts':               3,
  'Buckhead Apartments':              3,
  'Karen Lake':                       3,
  'Austin Creek':                     3,
  '(NCH) West End at Fayetteville':   3,
  '(NCH) The One at Fayetteville':    3,
  'Corporate':                        3,
  'Eagle Landing':                    2,
  'The One at Hope Mills':            2,
  'Franklin Cleaning':                2,
  'Jill Cleaning':                    2,
  'Susie Cleaning':                   2,
  'Heather Cleaning':                 1,
  'Annette Cleaning':                 1,
  'Bill Cleaning':                    1,
  'Michael Cleaning':                 1,
  'Molly Realtor':                    1,
  'Other':                            1,
  'Amy Cleaning':                     0, // inactive
}

// ── Price calculator ───────────────────────────────────────────────────────────
function getPrice(mgmtName, clientName, type, roomSize) {
  if (mgmtName === 'Private Customer') {
    const base = PRIVATE_BASE[clientName] || 0
    if (type === 'Deep Clean')               return { base: 275, fee: 0 }
    if (type === 'Touch Up')                 return { base: Math.round(base * 0.5), fee: 0 }
    return { base, fee: 0 }
  }
  const p = PRICES[mgmtName]
  if (!p) return { base: 0, fee: 0 }

  if (type === 'Office Clean') {
    // Hawthorne has weekly $195 / biweekly $225; pick one randomly
    const office = p.office2 ? (Math.random() < 0.5 ? p.office : p.office2) : (p.office || 0)
    return { base: office, fee: 0 }
  }

  const baseMap = { '1BR': p.std1BR, '2BR': p.std2BR, '3BR': p.std3BR }
  const base = (roomSize && baseMap[roomSize]) || 0
  if (type === 'Deep Clean')             return { base, fee: p.dcFee  || 0 }
  if (type === 'Heavy Deep Clean') return { base, fee: p.hdcFee || 0 }
  return { base, fee: 0 }
}

// ── Expense templates ──────────────────────────────────────────────────────────
const EXPENSE_TEMPLATES = {
  weekly: [
    { description:'Fuel & Transportation',   category:'Transportation', amtMin:80,  amtMax:160, method:'cash'  },
  ],
  monthly: [
    { description:'Cleaning Supplies',        category:'Supplies',      amtMin:180, amtMax:320, method:'card'  },
    { description:'Vehicle Insurance',        category:'Insurance',     amtMin:240, amtMax:260, method:'ach'   },
    { description:'Phone Plan',               category:'Communications',amtMin:115, amtMax:125, method:'card'  },
    { description:'Software & Tools',         category:'Technology',    amtMin:45,  amtMax:65,  method:'card'  },
  ],
  quarterly: [
    { description:'Equipment Maintenance',    category:'Equipment',     amtMin:200, amtMax:450, method:'check' },
    { description:'Marketing & Advertising',  category:'Marketing',     amtMin:150, amtMax:300, method:'card'  },
  ],
}

// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const TODAY = new Date('2026-05-29T12:00:00')

  // ── Get admin user ──────────────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) throw new Error('No admin user found')

  // ── Get all active staff (non-admin users) ──────────────────────────────────
  const staffUsers = await prisma.user.findMany({
    where: { role: 'user', status: 'active' }
  })
  console.log(`Staff available: ${staffUsers.map(u => u.name.split(' ')[0]).join(', ')}`)

  // ── Get all clients ─────────────────────────────────────────────────────────
  const allClients = await prisma.client.findMany({ include: { management: true } })
  const clientMap  = Object.fromEntries(allClients.map(c => [c.name, c]))

  // ── Build weighted client pool ──────────────────────────────────────────────
  const weightedPool = []
  allClients.forEach(c => {
    const w = CLIENT_WEIGHTS[c.name] || 0
    for (let i = 0; i < w; i++) weightedPool.push(c.name)
  })

  // ── Clear existing demo services, invoices ──────────────────────────────────
  console.log('\nClearing existing services and invoices...')
  await prisma.invoicePayment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.serviceStaff.deleteMany()
  await prisma.servicePhoto.deleteMany()
  await prisma.service.deleteMany()
  await prisma.expense.deleteMany({ where: { category: { not: 'payroll' } } })
  console.log('✓ Cleared\n')

  // ── Generate services ───────────────────────────────────────────────────────
  const workdays = getWorkdays('2026-01-01', '2026-05-29')
  console.log(`Generating services for ${workdays.length} workdays...`)

  // Time slots available per day
  const TIME_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00',
                      '11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00']

  const createdServices = [] // for invoice grouping: { id, clientId, clientName, mgmt, date, total, status }
  let svcCount = 0

  for (const day of workdays) {
    const dayStr = day.toISOString().split('T')[0]
    const isPast = day < TODAY
    const numServices = rnd(7, 10)

    // Pick unique clients for the day (no duplicates)
    const todayClientsNames = []
    const poolCopy = [...weightedPool]
    while (todayClientsNames.length < numServices && poolCopy.length > 0) {
      const i = Math.floor(Math.random() * poolCopy.length)
      const name = poolCopy.splice(i, 1)[0]
      if (!todayClientsNames.includes(name)) todayClientsNames.push(name)
    }

    // Pick time slots
    const slots = pickN(TIME_SLOTS, numServices).sort()

    for (let s = 0; s < todayClientsNames.length; s++) {
      const clientName = todayClientsNames[s]
      const client     = clientMap[clientName]
      if (!client) continue

      const mgmtName = client.management?.name || 'Other'
      const isPrivate = mgmtName === 'Private Customer'
      const isOffice  = clientName === 'Jamestown' || clientName === 'Corporate' ||
                        clientName.includes('NCH')

      // Determine service type
      let type
      if (isPrivate) {
        type = pick(PRIVATE_TYPES)
      } else if (isOffice && Math.random() < 0.4) {
        type = pick(OFFICE_CLIENT_TYPES)
      } else {
        type = pick(COMMERCIAL_TYPES)
      }

      // Room size
      let roomSize = null
      if (type === 'Office Clean') {
        roomSize = 'Office'
      } else if (!isPrivate) {
        const pool = ROOM_POOL[mgmtName] || ['2BR']
        roomSize = pick(pool)
      }

      // Price
      const { base, fee } = getPrice(mgmtName, clientName, type, roomSize)
      const total = base + fee

      // Payment method
      let payMethod
      if (isPrivate) payMethod = pick(PAY_PRIVATE)
      else if (mgmtName === 'Corporate Living Solutions') payMethod = pick(PAY_CORPORATE)
      else if (mgmtName === 'National Corporate Housing') payMethod = pick(PAY_NCH)
      else payMethod = pick(PAY_COMMERCIAL)

      // Status
      const status = isPast
        ? (Math.random() < 0.04 ? 'cancelled' : 'completed')
        : (day.toDateString() === TODAY.toDateString() ? 'in_progress' : 'pending')

      // Staff (1-3 per service)
      const numStaff = type === 'Deep Clean' || type === 'Heavy Deep Clean' ? rnd(2,3) : rnd(1,2)
      const assignedStaff = pickN(staffUsers, numStaff)

      // Unit
      const unit = (roomSize && roomSize !== 'Office' && !isPrivate) ? randomUnit() : null

      const svc = await prisma.service.create({
        data: {
          clientId:      client.id,
          serviceDate:   new Date(dayStr + 'T12:00:00'),
          serviceTime:   slots[s] || '08:00',
          type,
          address:       client.address || null,
          unit,
          roomSize,
          basePrice:     base,
          additionalFee: fee,
          total,
          paymentMethod: payMethod,
          frequency:     'one_time',
          status,
          internalNotes: pick(INT_NOTES) || null,
          staffNotes:    pick(STAFF_NOTES_POOL) || null,
          completedAt:   (status === 'completed') ? new Date(dayStr + 'T17:00:00') : null,
          createdById:   admin.id,
        }
      })

      // Assign staff
      if (assignedStaff.length > 0) {
        await prisma.serviceStaff.createMany({
          data: assignedStaff.map(u => ({ serviceId: svc.id, userId: u.id }))
        })
      }

      createdServices.push({
        id: svc.id, clientId: client.id, clientName, mgmtName,
        date: day, monthK: monthKey(day), total, status,
      })
      svcCount++
    }

    if (svcCount % 100 === 0) process.stdout.write(`  ${svcCount} services...\r`)
  }
  console.log(`✓ ${svcCount} services created\n`)

  // ── Generate invoices (monthly, per commercial client) ──────────────────────
  console.log('Generating invoices...')
  let invCount = 0, invSeq = 1

  // Group completed services by (clientId, month) — commercial only
  const groups = {}
  for (const s of createdServices) {
    if (s.mgmtName === 'Private Customer' || s.mgmtName === 'Other') continue
    if (s.status === 'cancelled' || s.total === 0) continue
    const key = `${s.clientId}__${s.monthK}`
    if (!groups[key]) groups[key] = { clientId: s.clientId, clientName: s.clientName, month: s.monthK, services: [] }
    groups[key].services.push(s)
  }

  const MONTHS_STATUS = {
    '2026-01': 'paid', '2026-02': 'paid', '2026-03': 'paid',
    '2026-04': 'paid', '2026-05': 'sent',
  }

  for (const g of Object.values(groups)) {
    if (g.services.length === 0) continue
    const [yr, mo] = g.month.split('-')
    const periodFrom = new Date(`${yr}-${mo}-01T12:00:00`)
    const lastDay    = new Date(parseInt(yr), parseInt(mo), 0).getDate()
    const periodTo   = new Date(`${yr}-${mo}-${lastDay}T12:00:00`)
    const subtotal   = g.services.reduce((sum, s) => sum + s.total, 0)
    const status     = MONTHS_STATUS[g.month] || 'draft'
    const paidAt     = (status === 'paid') ? new Date(`${yr}-${mo}-${lastDay}T12:00:00`) : null
    const dueDate    = new Date(parseInt(yr), parseInt(mo), 15)
    const invNum     = `INV-${yr}${mo}-${String(invSeq++).padStart(3,'0')}`

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber:  invNum,
        invoiceMode:    'auto',
        clientId:       g.clientId,
        periodFrom,
        periodTo,
        subtotal,
        additionalFees: 0,
        taxRate:        0,
        taxAmount:      0,
        total:          subtotal,
        amountPaid:     status === 'paid' ? subtotal : 0,
        balanceDue:     status === 'paid' ? 0 : subtotal,
        paymentMethod:  g.mgmtName === 'Private Customer' ? 'zelle' : 'check',
        status,
        dueDate,
        paidAt,
        notes:          `Services rendered ${periodFrom.toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
        createdById:    admin.id,
        issuedAt:       periodFrom,
      }
    })

    // Create invoice items
    await prisma.invoiceItem.createMany({
      data: g.services.map(s => ({
        invoiceId:   inv.id,
        serviceId:   s.id,
        description: `${s.clientName} — Service`,
        quantity:    1,
        unitPrice:   s.total,
        total:       s.total,
      }))
    })

    invCount++
  }
  console.log(`✓ ${invCount} invoices created\n`)

  // ── Generate expenses ───────────────────────────────────────────────────────
  console.log('Generating expenses...')
  let expCount = 0, expSeq = 1

  const months = ['2026-01','2026-02','2026-03','2026-04','2026-05']
  const weeks   = getWorkdays('2026-01-01','2026-05-29')
                    .filter(d => d.getDay() === 1) // Mondays only = weekly expenses

  // Weekly fuel
  for (const monday of weeks) {
    const amt = rnd(EXPENSE_TEMPLATES.weekly[0].amtMin, EXPENSE_TEMPLATES.weekly[0].amtMax)
    const t = EXPENSE_TEMPLATES.weekly[0]
    await prisma.expense.create({
      data: {
        description:   t.description,
        category:      t.category,
        amount:        amt,
        expenseDate:   monday,
        paymentMethod: t.method,
        supplier:      'Gas Station',
        createdById:   admin.id,
      }
    })
    expCount++
  }

  // Monthly recurring
  for (const month of months) {
    const [yr, mo] = month.split('-')
    const expDate  = new Date(`${yr}-${mo}-05T12:00:00`)

    for (const t of EXPENSE_TEMPLATES.monthly) {
      const amt = rnd(t.amtMin, t.amtMax)
      await prisma.expense.create({
        data: {
          description:   t.description,
          category:      t.category,
          amount:        amt,
          expenseDate:   expDate,
          paymentMethod: t.method,
          createdById:   admin.id,
        }
      })
      expCount++
    }
  }

  // Quarterly equipment + marketing (Q1 and Q2)
  const quarterlyDates = ['2026-01-15', '2026-04-10']
  for (const dateStr of quarterlyDates) {
    for (const t of EXPENSE_TEMPLATES.quarterly) {
      const amt = rnd(t.amtMin, t.amtMax)
      await prisma.expense.create({
        data: {
          description:   t.description,
          category:      t.category,
          amount:        amt,
          expenseDate:   new Date(dateStr + 'T12:00:00'),
          paymentMethod: t.method,
          createdById:   admin.id,
        }
      })
      expCount++
    }
  }

  console.log(`✓ ${expCount} expenses created\n`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalRevenue = createdServices
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + s.total, 0)

  console.log('══════════════════════════════')
  console.log('  DEMO DATA SUMMARY')
  console.log('══════════════════════════════')
  console.log(`  Services   : ${svcCount}`)
  console.log(`  Invoices   : ${invCount}`)
  console.log(`  Expenses   : ${expCount}`)
  console.log(`  Revenue    : $${totalRevenue.toLocaleString()}`)
  console.log(`  Workdays   : ${workdays.length} (Jan 1 – May 29)`)
  console.log('══════════════════════════════')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
