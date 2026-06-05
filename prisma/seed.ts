import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// ── Date helpers (all UTC noon to avoid timezone date shifts) ──
function utcDate(y: number, m: number, d: number): Date {
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00Z`)
}
function daysFrom(base: Date, n: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}
function lastDayOf(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

// ── Constants ──
const TODAY       = utcDate(2026, 5, 27)
const START       = utcDate(2026, 1, 1)
const END         = utcDate(2026, 5, 29)
const CUTOFF      = utcDate(2026, 5, 27)  // May 27+ → pending

const TYPES     = ['Standard Clean', 'Deep Clean', 'Move In/Out', 'Office Clean']
const P_MIN     = [100, 150, 160, 130]
const P_MAX     = [150, 200, 200, 170]
const TIMES     = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']
const METHODS   = ['cash', 'zelle', 'venmo', 'check'] as const
const UNITS     = ['Apt 101', 'Unit 204', 'Apt 312', 'Unit 105', 'Apt 218', 'Unit 401', 'Apt 507', 'Unit 308']
const ROOMS     = ['1 Bedroom', '2 Bedrooms', '3 Bedrooms', 'Studio', '2 Bedrooms', '3 Bedrooms', '2 Bedrooms', '1 Bedroom']

// Deterministic int in [min, max] based on a seed
function det(seed: number, min: number, max: number) {
  const x = Math.abs(Math.sin(seed + 1) * 93731)
  return min + (Math.floor(x) % (max - min + 1))
}

async function main() {
  console.log('🌱 Seeding Joyful CRM...')

  // ── Clear (dependency order) ──
  await prisma.auditLog.deleteMany()
  await prisma.invoicePayment.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.servicePhoto.deleteMany()
  await prisma.serviceStaff.deleteMany()
  await prisma.payrollRecord.deleteMany()
  await prisma.service.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.recurringExpense.deleteMany()
  await prisma.inventoryProduct.deleteMany()
  await prisma.asset.deleteMany()
  await prisma.client.deleteMany()
  await prisma.userPermission.deleteMany()
  console.log('  ✓ Tables cleared')

  // Reset auto-increment sequences so service/expense numbers start at 1
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"services"', 'serviceNumber'), 1, false)`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"expenses"', 'expenseNumber'), 1, false)`
  console.log('  ✓ Sequences reset')

  // ── Users ──
  const pwd = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@joyfulcleaning.com' },
    update: { name: 'Admin', password: pwd, role: 'admin', status: 'active' },
    create: { email: 'admin@joyfulcleaning.com', name: 'Admin', password: pwd, role: 'admin', status: 'active' },
  })

  // 4 employees — $600/week fixed
  const emps = await Promise.all([
    prisma.user.upsert({ where: { email: 'maria@joyfulservices.com' }, update: {}, create: { email: 'maria@joyfulservices.com', name: 'Maria Garcia', password: pwd, role: 'user', status: 'active', scheduleType: 'fixed_day' } }),
    prisma.user.upsert({ where: { email: 'jose@joyfulservices.com' }, update: {}, create: { email: 'jose@joyfulservices.com', name: 'Jose Rodriguez', password: pwd, role: 'user', status: 'active', scheduleType: 'fixed_day' } }),
    prisma.user.upsert({ where: { email: 'ana@joyfulservices.com' }, update: {}, create: { email: 'ana@joyfulservices.com', name: 'Ana Martinez', password: pwd, role: 'user', status: 'active', scheduleType: 'fixed_day' } }),
    prisma.user.upsert({ where: { email: 'carlos@joyfulservices.com' }, update: {}, create: { email: 'carlos@joyfulservices.com', name: 'Carlos Torres', password: pwd, role: 'user', status: 'active', scheduleType: 'fixed_day' } }),
  ])
  console.log('  ✓ 5 users (1 admin + 4 employees)')

  // ── Clients ──
  const CLIENT_DEFS = [
    { name: 'Austin Creek',               address: '168 Autumn Creek Dr, Fayetteville, NC 28314', zip: '28314', freq: 'weekly' },
    { name: 'West End at Fayetteville',   address: '2640 Skibo Rd, Fayetteville, NC 28314',        zip: '28314', freq: 'weekly' },
    { name: 'Buckhead Apartments',        address: '4055 Raeford Rd, Fayetteville, NC 28304',      zip: '28304', freq: 'weekly' },
    { name: 'Jamestown',                  address: '3710 Morganton Rd, Fayetteville, NC 28314',    zip: '28314', freq: 'weekly' },
    { name: 'Hawthorne at the Pines',     address: '7701 Pines Rd, Fayetteville, NC 28304',        zip: '28304', freq: 'weekly' },
  ]

  const clients = await Promise.all(CLIENT_DEFS.map(c =>
    prisma.client.create({
      data: {
        name: c.name, type: 'commercial', frequency: c.freq as any,
        address: c.address, city: 'Fayetteville', state: 'NC', zip: c.zip, status: 'active',
        email: `billing@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `910-${det(c.name.length, 200, 999)}-${det(c.name.length * 3, 1000, 9999)}`,
      },
    })
  ))
  console.log('  ✓ 5 clients')

  // ─────────────────────────────────────────────
  // ── Services: Jan 1 → May 29, 5-9/day ──
  // ─────────────────────────────────────────────
  type SvcRow = {
    id: string; clientId: string; serviceDate: Date; serviceTime: string
    type: string; address: string | null; unit: string; roomSize: string
    basePrice: number; total: number; status: string; completedAt: Date | null
    paymentMethod: string; createdById: string
  }
  type StaffRow = { id: string; serviceId: string; userId: string }

  const serviceRows: SvcRow[] = []
  const staffRows: StaffRow[]  = []

  // Track completed totals per client×month for invoicing
  // key: `${clientId}::${yyyy-mm}`  value: { total, ids }
  const monthBuckets = new Map<string, { total: number; ids: string[] }>()

  let wdayIdx = 0  // weekday counter for cycling 5-9
  let cur = new Date(START)
  while (cur <= END) {
    const dow = cur.getUTCDay()          // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) { cur = daysFrom(cur, 1); continue }

    const date   = new Date(cur)
    const isComp = date < CUTOFF
    const status = isComp ? 'completed' : 'pending'
    const yyyyMM = date.toISOString().substring(0, 7)
    const count  = (wdayIdx % 5) + 5    // cycles 5,6,7,8,9
    const day    = wdayIdx              // alias for det() seeds

    for (let slot = 0; slot < count; slot++) {
      const id        = randomUUID()
      const cli       = clients[slot % 5]
      const typeIdx   = det(day * 11 + slot * 7, 0, 3)
      const price     = det(day * 13 + slot * 9, P_MIN[typeIdx], P_MAX[typeIdx])
      const time      = TIMES[slot % TIMES.length]
      const unit      = UNITS[(day + slot) % UNITS.length]
      const roomSize  = ROOMS[(day + slot) % ROOMS.length]
      const method    = METHODS[(day + slot) % METHODS.length]

      serviceRows.push({
        id, clientId: cli.id,
        serviceDate: date, serviceTime: time,
        type: TYPES[typeIdx], address: cli.address,
        unit, roomSize,
        basePrice: price, total: price,
        status, completedAt: isComp ? date : null,
        paymentMethod: method, createdById: admin.id,
      })

      if (isComp) {
        const bKey = `${cli.id}::${yyyyMM}`
        if (!monthBuckets.has(bKey)) monthBuckets.set(bKey, { total: 0, ids: [] })
        const b = monthBuckets.get(bKey)!
        b.total += price
        b.ids.push(id)
      }

      // Assign 1 or 2 employees
      const e1 = (day + slot) % 4
      const e2 = (day + slot + 2) % 4
      const twoStaff = det(day * 17 + slot * 13, 0, 2) > 0   // 67% two staff
      staffRows.push({ id: randomUUID(), serviceId: id, userId: emps[e1].id })
      if (twoStaff && e2 !== e1) {
        staffRows.push({ id: randomUUID(), serviceId: id, userId: emps[e2].id })
      }
    }
    wdayIdx++
    cur = daysFrom(cur, 1)
  }

  await prisma.service.createMany({ data: serviceRows as any })
  await prisma.serviceStaff.createMany({ data: staffRows })
  console.log(`  ✓ ${serviceRows.length} services  (${serviceRows.filter(s => s.status === 'completed').length} completed, ${serviceRows.filter(s => s.status === 'pending').length} pending)`)
  console.log(`  ✓ ${staffRows.length} staff assignments`)

  // ─────────────────────────────────────────────
  // ── Invoices: one per client × month ──
  // ─────────────────────────────────────────────
  // Build a fast lookup: id → SvcRow
  const svcMap = new Map(serviceRows.map(s => [s.id, s]))

  const invoiceRows: any[]     = []
  const itemRows: any[]        = []
  const paymentRows: any[]     = []
  let invNum = 1

  const MONTHS: Array<[number, number]> = [
    [2026,1],[2026,2],[2026,3],[2026,4],[2026,5],
  ]

  for (const cli of clients) {
    for (const [y, m] of MONTHS) {
      const yyyyMM = `${y}-${String(m).padStart(2,'0')}`
      const bKey   = `${cli.id}::${yyyyMM}`
      const bucket = monthBuckets.get(bKey)
      if (!bucket || bucket.total === 0) continue

      const invId     = randomUUID()
      const numStr    = `INV-${String(invNum).padStart(4, '0')}`
      const lastDay   = lastDayOf(y, m)
      const periodFrom = utcDate(y, m, 1)
      const periodTo   = utcDate(y, m, lastDay)
      const issuedAt   = utcDate(y, m, Math.min(lastDay, 28))

      // Jan-Apr: paid; May: sent
      const isMay    = m === 5
      const status   = isMay ? 'sent' : 'paid'
      const paid     = isMay ? 0 : bucket.total
      const balance  = bucket.total - paid

      const nextM    = m === 12 ? 1 : m + 1
      const nextY    = m === 12 ? y + 1 : y
      const dueDate  = utcDate(nextY, nextM, 15)
      // paidAt = same day as issuedAt (keeps payment within the invoice month)
      const paidAt   = status === 'paid' ? issuedAt : null

      invoiceRows.push({
        id: invId, invoiceNumber: numStr,
        clientId: cli.id, createdById: admin.id,
        periodFrom, periodTo, issuedAt,
        subtotal: bucket.total, total: bucket.total,
        amountPaid: paid, balanceDue: balance,
        status, dueDate, paidAt,
      })

      // One line item per service
      for (const svcId of bucket.ids) {
        const s = svcMap.get(svcId)!
        const d = s.serviceDate
        const label = `${d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})} – ${s.type} – ${s.unit}`
        itemRows.push({
          id: randomUUID(), invoiceId: invId, serviceId: svcId,
          description: label, quantity: 1,
          unitPrice: s.basePrice, total: s.total,
        })
      }

      // Payment record for paid invoices
      if (status === 'paid') {
        paymentRows.push({
          id: randomUUID(), invoiceId: invId,
          amount: paid, method: 'zelle', platform: 'zelle',
          paidAt: paidAt!, createdById: admin.id,
        })
      }

      invNum++
    }
  }

  await prisma.invoice.createMany({ data: invoiceRows as any })
  await prisma.invoiceItem.createMany({ data: itemRows as any })
  await prisma.invoicePayment.createMany({ data: paymentRows as any })
  console.log(`  ✓ ${invoiceRows.length} invoices  (${paymentRows.length} paid, ${invoiceRows.length - paymentRows.length} sent)`)
  console.log(`  ✓ ${itemRows.length} invoice items`)

  // Mark invoiced services
  const invoicedIds = itemRows.map(i => i.serviceId).filter(Boolean) as string[]
  const CHUNK = 500
  for (let i = 0; i < invoicedIds.length; i += CHUNK) {
    await prisma.service.updateMany({
      where: { id: { in: invoicedIds.slice(i, i + CHUNK) } },
      data: { invoicedAt: TODAY },
    })
  }
  console.log(`  ✓ ${invoicedIds.length} services marked as invoiced`)

  // ─────────────────────────────────────────────
  // ── Payroll Expenses: every Friday, 4 × $600 ──
  // ─────────────────────────────────────────────
  // First Friday of 2026 = Jan 2
  const payrollRows: any[] = []
  const fri0 = utcDate(2026, 1, 2)
  const lastPayFri = utcDate(2026, 5, 23) // last Friday before May 27

  let fri = new Date(fri0)
  while (fri <= lastPayFri) {
    const label = fri.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    for (const emp of emps) {
      payrollRows.push({
        description: `Payroll – ${emp.name} – ${label}`,
        category: 'Payroll',
        amount: 600,
        expenseDate: new Date(fri),
        paymentMethod: 'zelle',
        createdById: admin.id,
      })
    }
    fri = daysFrom(fri, 7)
  }
  const payrollWeeks = payrollRows.length / 4

  await prisma.expense.createMany({ data: payrollRows as any })
  console.log(`  ✓ ${payrollRows.length} payroll entries  (${payrollWeeks} weeks × 4 employees × $600)`)

  // ─────────────────────────────────────────────
  // ── Operating Expenses ──
  // ─────────────────────────────────────────────
  const MONTHS_LIST = [
    [2026,1],[2026,2],[2026,3],[2026,4],[2026,5],
  ] as [number,number][]
  const SUPPLY_AMTS = [290, 315, 280, 340, 305]
  const FUEL_AMTS   = [88, 72, 92, 65, 84, 78, 90, 76, 68, 86]

  const opRows: any[] = []

  // Fuel — two vans every other week (~bi-weekly fill)
  for (let i = 0; i < 10; i++) {
    const date = daysFrom(utcDate(2026, 1, 5), i * 14)
    if (date > TODAY) break
    opRows.push({ description: `Fuel – Van #${(i % 2) + 1}`, category: 'Fuel & Transportation', amount: FUEL_AMTS[i], expenseDate: date, paymentMethod: 'cash', createdById: admin.id })
  }

  // Monthly fixed: insurance, van payment, supplies, software, storage
  for (let idx = 0; idx < MONTHS_LIST.length; idx++) {
    const [y, m] = MONTHS_LIST[idx]
    const mon = utcDate(y, m, 1)
    opRows.push({ description: 'General Liability Insurance', category: 'Insurance', amount: 350, expenseDate: mon, paymentMethod: 'check', createdById: admin.id })
    opRows.push({ description: 'Storage Unit Rental', category: 'Office & Admin', amount: 120, expenseDate: mon, paymentMethod: 'card', createdById: admin.id })
    opRows.push({ description: 'Van Payment – 2022 Ford Transit', category: 'Vehicle', amount: 450, expenseDate: utcDate(y, m, 15), paymentMethod: 'ach', createdById: admin.id })
    opRows.push({ description: 'Cleaning Supplies – Monthly Restock', category: 'Supplies', amount: SUPPLY_AMTS[idx], expenseDate: utcDate(y, m, 8), paymentMethod: 'card', createdById: admin.id })
    opRows.push({ description: 'Jobber CRM Software', category: 'Software', amount: 79, expenseDate: utcDate(y, m, 5), paymentMethod: 'card', createdById: admin.id })
  }

  // PPE quarterly
  opRows.push({ description: 'PPE – Nitrile Gloves & Masks (bulk)', category: 'Supplies', amount: 120, expenseDate: utcDate(2026,1,20), paymentMethod: 'card', createdById: admin.id })
  opRows.push({ description: 'PPE – Nitrile Gloves & Masks (bulk)', category: 'Supplies', amount: 135, expenseDate: utcDate(2026,4,15), paymentMethod: 'card', createdById: admin.id })

  // Vehicle maintenance
  opRows.push({ description: 'Oil Change – Van #1', category: 'Vehicle', amount: 75, expenseDate: utcDate(2026,2,20), paymentMethod: 'cash', createdById: admin.id })
  opRows.push({ description: 'Oil Change – Van #2', category: 'Vehicle', amount: 75, expenseDate: utcDate(2026,4,18), paymentMethod: 'cash', createdById: admin.id })
  opRows.push({ description: 'Tire Rotation – Van #1', category: 'Vehicle', amount: 45, expenseDate: utcDate(2026,3,10), paymentMethod: 'cash', createdById: admin.id })

  // Equipment
  opRows.push({ description: 'Vacuum Repair – Dyson V15', category: 'Equipment', amount: 120, expenseDate: utcDate(2026,3,10), paymentMethod: 'cash', createdById: admin.id })
  opRows.push({ description: 'New Steam Mop', category: 'Equipment', amount: 180, expenseDate: utcDate(2026,4,22), paymentMethod: 'card', createdById: admin.id })

  // Marketing
  opRows.push({ description: 'Facebook Ads – Jan/Feb', category: 'Marketing', amount: 150, expenseDate: utcDate(2026,1,31), paymentMethod: 'card', createdById: admin.id })
  opRows.push({ description: 'Google Ads – Spring Campaign', category: 'Marketing', amount: 300, expenseDate: utcDate(2026,3,1), paymentMethod: 'card', createdById: admin.id })
  opRows.push({ description: 'Facebook Ads – Apr/May', category: 'Marketing', amount: 200, expenseDate: utcDate(2026,4,30), paymentMethod: 'card', createdById: admin.id })
  opRows.push({ description: 'Business Cards – Reprint', category: 'Marketing', amount: 55, expenseDate: utcDate(2026,2,15), paymentMethod: 'card', createdById: admin.id })

  await prisma.expense.createMany({ data: opRows as any })
  console.log(`  ✓ ${opRows.length} operating expenses`)

  // ── Inventory ──
  await prisma.inventoryProduct.createMany({ data: [
    { sku: 'CHM-001', name: 'Pine-Sol Multi-Surface Cleaner', category: 'Chemicals',    unitOfMeasure: 'Gallon', unitCost: 12.50, currentStock: 8,  minimumStock: 4, supplier: "Sam's Club" },
    { sku: 'CHM-002', name: 'Bleach Disinfectant',            category: 'Chemicals',    unitOfMeasure: 'Gallon', unitCost: 4.99,  currentStock: 12, minimumStock: 6, supplier: "Sam's Club" },
    { sku: 'CHM-003', name: 'Glass & Surface Cleaner',        category: 'Chemicals',    unitOfMeasure: 'Gallon', unitCost: 8.75,  currentStock: 3,  minimumStock: 4, supplier: 'Costco' },
    { sku: 'CHM-004', name: 'Bathroom Disinfectant Spray',    category: 'Chemicals',    unitOfMeasure: 'Liter',  unitCost: 6.50,  currentStock: 6,  minimumStock: 4, supplier: "Sam's Club" },
    { sku: 'EQP-001', name: 'Microfiber Cloths (Pack 24)',    category: 'Equipment',    unitOfMeasure: 'Pack',   unitCost: 18.99, currentStock: 5,  minimumStock: 3, supplier: 'Amazon' },
    { sku: 'EQP-002', name: 'Mop Heads Replacement',          category: 'Equipment',    unitOfMeasure: 'Pack',   unitCost: 22.50, currentStock: 2,  minimumStock: 4, supplier: 'Home Depot' },
    { sku: 'EQP-003', name: 'Scrub Sponges (Pack 10)',        category: 'Equipment',    unitOfMeasure: 'Pack',   unitCost: 7.99,  currentStock: 8,  minimumStock: 5, supplier: 'Amazon' },
    { sku: 'PPE-001', name: 'Nitrile Gloves (Box 100)',       category: 'PPE',          unitOfMeasure: 'Box',    unitCost: 14.99, currentStock: 4,  minimumStock: 6, supplier: 'Costco' },
    { sku: 'PPE-002', name: 'Disposable Masks (Box 50)',      category: 'PPE',          unitOfMeasure: 'Box',    unitCost: 9.99,  currentStock: 3,  minimumStock: 3, supplier: "Sam's Club" },
    { sku: 'ACC-001', name: 'Trash Bags 13-gal (Box 100)',    category: 'Accessories',  unitOfMeasure: 'Box',    unitCost: 19.99, currentStock: 6,  minimumStock: 3, supplier: "Sam's Club" },
    { sku: 'ACC-002', name: 'Paper Towels (Case 30 rolls)',   category: 'Accessories',  unitOfMeasure: 'Pack',   unitCost: 35.00, currentStock: 2,  minimumStock: 3, supplier: 'Costco' },
  ]})
  console.log('  ✓ 11 inventory items')

  // ── Assets ──
  await prisma.asset.createMany({ data: [
    { name: '2020 Ford Transit Van #1',  type: 'Vehicle',    purchaseDate: new Date('2020-03-15'), purchaseValue: 29500, currentValue: 18200, annualDepreciation: 15, serialNumber: '1FTBW2CM0LKB12345', status: 'active',      notes: 'Primary cleaning van. Maintenance up to date.' },
    { name: '2022 Ford Transit Van #2',  type: 'Vehicle',    purchaseDate: new Date('2022-07-01'), purchaseValue: 33800, currentValue: 27500, annualDepreciation: 12, serialNumber: '1FTBW2CM2NKC67890', status: 'active',      notes: 'Secondary van. Under financing.' },
    { name: 'Dyson V15 Vacuum Set (×4)', type: 'Equipment',  purchaseDate: new Date('2023-01-10'), purchaseValue: 2400,  currentValue: 1600,  annualDepreciation: 20, serialNumber: 'DYS-V15-2301',       status: 'active',      notes: '4 units. One recently repaired.' },
    { name: 'Industrial Steam Mop (×2)', type: 'Equipment',  purchaseDate: new Date('2023-06-20'), purchaseValue: 600,   currentValue: 380,   annualDepreciation: 25, status: 'active' },
    { name: 'MacBook Air M2 – Office',   type: 'Technology', purchaseDate: new Date('2023-09-01'), purchaseValue: 1299,  currentValue: 900,   annualDepreciation: 20, serialNumber: 'C02XM3XNMD6R',        status: 'active',      notes: 'Billing and scheduling.' },
    { name: 'iPhone 14 Business (×2)',   type: 'Technology', purchaseDate: new Date('2022-11-15'), purchaseValue: 1800,  currentValue: 1000,  annualDepreciation: 25, status: 'active',      notes: 'Team communication devices.' },
    { name: 'Pressure Washer – Ryobi',   type: 'Equipment',  purchaseDate: new Date('2021-08-10'), purchaseValue: 380,   currentValue: 150,   annualDepreciation: 25, serialNumber: 'RYB-PW-2108',         status: 'maintenance', notes: 'Needs pump seal replacement.' },
  ] as any[]})
  console.log('  ✓ 7 assets')

  // ─────────────────────────────────────────────
  // ── Summary ──
  // ─────────────────────────────────────────────
  const completed = serviceRows.filter(s => s.status === 'completed')
  const pending   = serviceRows.filter(s => s.status === 'pending')
  const totalRev  = completed.reduce((s, r) => s + r.total, 0)
  const totalInv  = invoiceRows.reduce((s, i) => s + Number(i.total), 0)
  const paidInv   = invoiceRows.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const sentInv   = invoiceRows.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)
  const totalPay  = payrollRows.reduce((s, e) => s + e.amount, 0)
  const totalOp   = opRows.reduce((s, e) => s + e.amount, 0)
  const totalExp  = totalPay + totalOp

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Seed complete — Joyful CRM')
  console.log('════════════════════════════════════════')
  console.log(`  Services completed : ${completed.length}`)
  console.log(`  Services pending   : ${pending.length}`)
  console.log(`  Revenue (completed): $${totalRev.toLocaleString('en-US')}`)
  console.log(`  Invoiced (total)   : $${totalInv.toLocaleString('en-US')}  (paid $${paidInv.toLocaleString('en-US')} | sent $${sentInv.toLocaleString('en-US')})`)
  console.log(`  Payroll (${payrollWeeks} wks×4)  : $${totalPay.toLocaleString('en-US')}`)
  console.log(`  Operating expenses : $${totalOp.toLocaleString('en-US')}`)
  console.log(`  Total expenses     : $${totalExp.toLocaleString('en-US')}`)
  console.log(`  Net Income (est.)  : $${(paidInv - totalExp).toLocaleString('en-US')}`)
  console.log('────────────────────────────────────────')
  console.log('  Login: admin@joyfulcleaning.com / admin123')
  console.log('════════════════════════════════════════\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
