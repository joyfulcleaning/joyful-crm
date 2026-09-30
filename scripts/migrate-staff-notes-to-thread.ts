import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Carries the old single-string `Service.staffNotes` into the new ServiceNote
// thread as its first message. The author was never recorded on that field, so
// these land with `authorId: null` and render without an avatar.
//
// Idempotent: any service that already has a note in the thread is skipped, so
// re-running can't duplicate. Pass --dry to preview without writing.
const DRY = process.argv.includes('--dry')

async function main() {
  const services = await prisma.service.findMany({
    where: { staffNotes: { not: null } },
    select: { id: true, serviceNumber: true, staffNotes: true, updatedAt: true },
    orderBy: { serviceNumber: 'asc' },
  })

  const withText = services.filter(s => (s.staffNotes ?? '').trim().length > 0)
  console.log(`Services with staffNotes text: ${withText.length}`)

  let migrated = 0
  let skipped = 0

  for (const s of withText) {
    const existing = await prisma.serviceNote.count({ where: { serviceId: s.id } })
    if (existing > 0) {
      skipped++
      continue
    }

    if (DRY) {
      console.log(`  would migrate #${s.serviceNumber}: ${(s.staffNotes ?? '').slice(0, 60)}`)
    } else {
      await prisma.serviceNote.create({
        data: {
          serviceId: s.id,
          authorId:  null,
          body:      (s.staffNotes ?? '').trim(),
          // Closest thing we have to when the note was written.
          createdAt: s.updatedAt,
        },
      })
    }
    migrated++
  }

  console.log(DRY ? `\nDRY RUN — would migrate ${migrated}, skip ${skipped}` : `\nMigrated ${migrated}, skipped ${skipped} (already had thread notes)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
