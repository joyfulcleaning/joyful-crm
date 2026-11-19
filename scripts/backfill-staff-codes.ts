// Gives every existing staff member a JF-00NN ID, in hire-date order. Only
// inserts into staff_profiles; the users table is read, never written. Safe to
// re-run: anyone who already has a code is skipped.
//
//   npx ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node"}' scripts/backfill-staff-codes.ts
//     prints the plan; add --apply at the end to write it
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { formatEmployeeCode, nextEmployeeCode } from '../lib/staff-profile-server'

async function main() {
  const apply = process.argv.includes('--apply')
  const users = await prisma.user.findMany({
    select: { id: true, name: true, hireDate: true, createdAt: true, hrProfile: { select: { employeeCode: true } } },
  })
  const pending = users
    .filter(u => !u.hrProfile?.employeeCode)
    .sort((a, b) => (a.hireDate ?? a.createdAt).getTime() - (b.hireDate ?? b.createdAt).getTime())

  let n = parseInt((await nextEmployeeCode()).slice(3), 10)
  for (const u of pending) {
    const employeeCode = formatEmployeeCode(n++)
    console.log(`${employeeCode}  ${u.name}`)
    if (apply) {
      await prisma.staffProfile.upsert({
        where: { userId: u.id },
        create: { userId: u.id, employeeCode },
        update: { employeeCode },
      })
    }
  }
  console.log(apply ? `Assigned ${pending.length} codes.` : `Dry run: ${pending.length} codes would be assigned.`)
}

main().finally(() => prisma.$disconnect())
