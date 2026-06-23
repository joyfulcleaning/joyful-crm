import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check the sequence name for serviceNumber
  const seqInfo = await prisma.$queryRaw<any[]>`
    SELECT sequence_name, last_value, increment_by
    FROM information_schema.sequences
    JOIN (SELECT last_value FROM pg_sequences WHERE schemaname='public') sq ON true
    WHERE sequence_schema = 'public'
    LIMIT 10
  `.catch(() => null)

  // Simpler: list all sequences
  const seqs = await prisma.$queryRaw<any[]>`
    SELECT schemaname, sequencename, last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
  `
  console.log('=== SEQUENCES ===')
  for (const s of seqs) console.log(`  ${s.sequencename}: last_value=${s.last_value}`)

  // Find the exact duplicate pairs and their dates to understand the pattern
  const dupes = await prisma.$queryRaw<any[]>`
    SELECT s."serviceNumber",
           MIN(s."serviceDate") as min_date,
           MAX(s."serviceDate") as max_date,
           COUNT(*) as cnt
    FROM services s
    GROUP BY s."serviceNumber"
    HAVING COUNT(*) > 1
    ORDER BY s."serviceNumber"
    LIMIT 5
  `
  console.log('\n=== FIRST 5 DUPLICATE serviceNumbers ===')
  for (const d of dupes) {
    console.log(`  #${d.serviceNumber}: ${d.cnt} services, dates from ${d.min_date?.toISOString().split('T')[0]} to ${d.max_date?.toISOString().split('T')[0]}`)
  }

  // What is the gap in dates between the two services sharing a number?
  // Are ALL duplicates pairing two specific date ranges?
  const allDupes = await prisma.$queryRaw<any[]>`
    SELECT s."serviceNumber", s."serviceDate", s.status, c.name as client_name
    FROM services s
    LEFT JOIN clients c ON s."clientId" = c.id
    WHERE s."serviceNumber" IN (
      SELECT "serviceNumber" FROM services GROUP BY "serviceNumber" HAVING COUNT(*) > 1
    )
    ORDER BY s."serviceNumber", s."serviceDate"
  `

  // Determine the two date clusters
  const dates = allDupes.map(s => new Date(s.serviceDate).getTime())
  const sorted = [...new Set(dates)].sort((a, b) => a - b)

  // Find the biggest gap (the break between the two clusters)
  let maxGap = 0, gapAt = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i-1]
    if (gap > maxGap) { maxGap = gap; gapAt = sorted[i-1] }
  }

  const clusterA = allDupes.filter(s => new Date(s.serviceDate).getTime() <= gapAt)
  const clusterB = allDupes.filter(s => new Date(s.serviceDate).getTime() > gapAt)

  const minA = new Date(Math.min(...clusterA.map(s => new Date(s.serviceDate).getTime())))
  const maxA = new Date(Math.max(...clusterA.map(s => new Date(s.serviceDate).getTime())))
  const minB = new Date(Math.min(...clusterB.map(s => new Date(s.serviceDate).getTime())))
  const maxB = new Date(Math.max(...clusterB.map(s => new Date(s.serviceDate).getTime())))

  console.log('\n=== DATE CLUSTERS ===')
  console.log(`  Cluster A (${clusterA.length} services): ${minA.toISOString().split('T')[0]} → ${maxA.toISOString().split('T')[0]}`)
  console.log(`  Cluster B (${clusterB.length} services): ${minB.toISOString().split('T')[0]} → ${maxB.toISOString().split('T')[0]}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
