/**
 * update-staff.js
 * 1. Renames the 5 non-admin staff to Aracelis, Taymie, Liz, Jenifer, Seydi
 * 2. Adds weekly $600 payroll expense every Friday Jan 1 – May 29 2026 per employee
 * Run: node prisma/update-staff.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const NEW_STAFF = [
  { name: 'Aracelis', email: 'aracelis@joyfulservices.com' },
  { name: 'Taymie',   email: 'taymie@joyfulservices.com'   },
  { name: 'Liz',      email: 'liz@joyfulservices.com'      },
  { name: 'Jenifer',  email: 'jenifer@joyfulservices.com'  },
  { name: 'Seydi',    email: 'seydi@joyfulservices.com'    },
]

function getFridays(startStr, endStr) {
  const days = [], cur = new Date(startStr + 'T12:00:00')
  const end  = new Date(endStr   + 'T12:00:00')
  while (cur <= end) {
    if (cur.getDay() === 5) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

async function main() {
  // 1. Get the 5 replaceable staff (not Natasha, not Admin)
  const toReplace = await prisma.user.findMany({
    where: {
      role: 'user',
      NOT: { email: { contains: 'natasha' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (toReplace.length !== 5) {
    console.log(`Found ${toReplace.length} staff users (expected 5):`)
    toReplace.forEach(u => console.log(`  ${u.name} <${u.email}>`))
    // Still proceed with however many we have
  }

  console.log('\nRenaming staff...')
  const updatedIds = []
  for (let i = 0; i < toReplace.length; i++) {
    const newInfo = NEW_STAFF[i]
    if (!newInfo) break
    await prisma.user.update({
      where: { id: toReplace[i].id },
      data: { name: newInfo.name, email: newInfo.email },
    })
    console.log(`  ✓ ${toReplace[i].name} → ${newInfo.name}`)
    updatedIds.push({ id: toReplace[i].id, name: newInfo.name })
  }

  // 2. Get admin user for createdById
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })

  // 3. Delete existing payroll expenses to avoid duplicates
  const deleted = await prisma.expense.deleteMany({ where: { category: 'payroll' } })
  console.log(`\nCleared ${deleted.count} existing payroll expenses`)

  // 4. Generate Friday payroll expenses
  const fridays = getFridays('2026-01-01', '2026-05-29')
  console.log(`\nAdding payroll expenses for ${fridays.length} Fridays × ${updatedIds.length} employees...`)

  let count = 0
  for (const friday of fridays) {
    for (const staff of updatedIds) {
      await prisma.expense.create({
        data: {
          category:      'payroll',
          description:   `Weekly payroll – ${staff.name}`,
          amount:        600,
          expenseDate:   friday,
          paymentMethod: 'check',
          supplier:      staff.name,
          createdById:   admin.id,
        },
      })
      count++
    }
  }

  console.log(`✓ ${count} payroll expenses created`)
  console.log(`\nSummary:`)
  console.log(`  Staff renamed : ${updatedIds.length}`)
  console.log(`  Fridays       : ${fridays.length}`)
  console.log(`  Payroll total : $${(count * 600).toLocaleString()}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
