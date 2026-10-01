import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Writes the Setting rows for notification events that have never been saved
// from the Settings page. The UI fills missing keys from its own client-side
// defaults, so the page can look correct while the server has no row at all —
// which is how service-note pushes stayed silent after shipping.
//
// Only creates what's absent; existing values are left exactly as they are.
// Pass --dry to preview.
const DRY = process.argv.includes('--dry')

const WANT: Record<string, string> = {
  'notif.serviceNote':            'false',
  'notif.serviceNote.push':       'true',
  'notif.serviceNote.roles':      'admin,user',
}

async function main() {
  let created = 0
  for (const [key, value] of Object.entries(WANT)) {
    const existing = await prisma.setting.findUnique({ where: { key } })
    if (existing) {
      console.log(`  keep    ${key} = "${existing.value}"`)
      continue
    }
    if (!DRY) await prisma.setting.create({ data: { key, value } })
    console.log(`  CREATE  ${key} = "${value}"`)
    created++
  }
  console.log(DRY ? `\nDRY RUN — would create ${created}` : `\nCreated ${created} row(s).`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
