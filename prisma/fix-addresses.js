/**
 * fix-addresses.js
 * Replaces truncated/malformed client addresses with clean geocodeable ones.
 * Run: node prisma/fix-addresses.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// name → clean address (street + city + state + zip)
const FIXED_ADDRESSES = {
  '(NCH) The One at Fayetteville':    '3010 Valentina Way, Fayetteville, NC 28314',
  '(NCH) West End at Fayetteville':   '3050 Plantation Garden Blvd, Fayetteville, NC 28303',
  'The One at Fayetteville':          '3010 Valentina Way, Fayetteville, NC 28314',
  'West End at Fayetteville':         '3050 Plantation Garden Blvd, Fayetteville, NC 28303',
  'Cumberland Towers Apts':           '2580 Cumberland Creek Dr, Fayetteville, NC 28306',
  'Austin Creek':                     '1131 Capeharbor Ct, Fayetteville, NC 28314',
  'Eagle Landing':                    '1000 Fazio Dr, Pinehurst, NC 28374',
  'Franklin Cleaning':                '3649 Glenbarry Cir, Fayetteville, NC 28311',
  'Karen Lake':                       '3605 Sapphire Rd, Fayetteville, NC 28303',
  'South Main Apartments':            '4003 William M Bill Luther St, Hope Mills, NC 28348',
  'Waterford':                        '801 Shell Dr, Spring Lake, NC 28390',
  'The One at Hope Mills':            '3680 Elk Rd, Hope Mills, NC 28348',
  'Other':                            '5432 Marvin Dr, Spring Lake, NC 28390',
  // Clean up property-name prefix from addresses that work but look noisy
  'Rim Creek Apts':                   '4811 Cellner Dr, Fayetteville, NC 28314',
  'South Pointe at Wayside':          '1002 S Pointe Dr, Raeford, NC 28376',
  'Buckhead Apartments':              '4428 Kinkead Ct, Fayetteville, NC 28314',
  'Jamestown':                        '1429 Bozeman Loop, Fayetteville, NC 28303',
  'Southern Pines Reserve':           '800 Churchill Downs Dr, Aberdeen, NC 28315',
  'Village Chase Apts':               '2737 Kentberry Ave, Fayetteville, NC 28301',
  'Corporate':                        '847 Scotch Hall Way, Fayetteville, NC 28303',
  'Summit at 401':                    '3325 Oak Forest Dr, Fayetteville, NC 28304',
}

async function main() {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, address: true } })
  let updated = 0

  for (const c of clients) {
    const newAddr = FIXED_ADDRESSES[c.name]
    if (newAddr && newAddr !== c.address) {
      await prisma.client.update({ where: { id: c.id }, data: { address: newAddr } })
      console.log(`  ✓ ${c.name}`)
      console.log(`      ${c.address}`)
      console.log(`    → ${newAddr}`)
      updated++
    }
  }

  console.log(`\n✓ Updated ${updated} client addresses`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
