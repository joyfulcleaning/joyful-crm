import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MANAGEMENTS = [
  {
    name: 'Hawthorne',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '100', active: true  },
      std2BR:          { value: '120', active: true  },
      std3BR:          { value: '140', active: true  },
      deepCleanFee:    { value: '100', active: true  },
      hdcFee:          { value: '130', active: true  },
      office:          { value: '195', frequency: 'Weekly',   active: true  },
      officeAlt:       { value: '225', frequency: 'Biweekly', active: true  },
      cancellationFee: { value: '',    active: false },
      inspectionFee:   { value: '',    active: false },
    },
  },
  {
    name: 'Cumberland Towers',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '110', active: true  },
      std2BR:          { value: '130', active: true  },
      std3BR:          { value: '150', active: true  },
      deepCleanFee:    { value: '100', active: true  },
      hdcFee:          { value: '130', active: true  },
      office:          { value: '200', frequency: 'Monthly',  active: true  },
      officeAlt:       { value: '',    frequency: 'Weekly',   active: false },
      cancellationFee: { value: '',    active: false },
      inspectionFee:   { value: '',    active: false },
    },
  },
  {
    name: 'Greystar',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '90',  active: true  },
      std2BR:          { value: '120', active: true  },
      std3BR:          { value: '150', active: true  },
      deepCleanFee:    { value: '50',  active: true  },
      hdcFee:          { value: '100', active: true  },
      office:          { value: '225', frequency: 'Biweekly', active: true  },
      officeAlt:       { value: '',    frequency: 'Weekly',   active: false },
      cancellationFee: { value: '',    active: false },
      inspectionFee:   { value: '',    active: false },
    },
  },
  {
    name: 'RPN',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '110', active: true  },
      std2BR:          { value: '130', active: true  },
      std3BR:          { value: '150', active: true  },
      deepCleanFee:    { value: '100', active: true  },
      hdcFee:          { value: '125', active: true  },
      office:          { value: '250', frequency: 'Weekly',   active: true  },
      officeAlt:       { value: '',    frequency: 'Biweekly', active: false },
      cancellationFee: { value: '',    active: false },
      inspectionFee:   { value: '',    active: false },
    },
  },
  {
    name: 'Corporate Living Solutions',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '120', active: true  },
      std2BR:          { value: '',    active: false },
      std3BR:          { value: '',    active: false },
      deepCleanFee:    { value: '',    active: false },
      hdcFee:          { value: '',    active: false },
      office:          { value: '',    frequency: 'Weekly',   active: false },
      officeAlt:       { value: '',    frequency: 'Biweekly', active: false },
      cancellationFee: { value: '',    active: false },
      inspectionFee:   { value: '',    active: false },
    },
  },
  {
    name: 'National Corporate Housing',
    priceConditions: {
      touchUp:         { value: '',    active: false },
      std1BR:          { value: '130', active: true  },
      std2BR:          { value: '150', active: true  },
      std3BR:          { value: '',    active: false },
      deepCleanFee:    { value: '',    active: false },
      hdcFee:          { value: '',    active: false },
      office:          { value: '',    frequency: 'Weekly',   active: false },
      officeAlt:       { value: '',    frequency: 'Biweekly', active: false },
      cancellationFee: { value: '75',  active: true  },
      inspectionFee:   { value: '75',  active: true  },
    },
  },
  {
    name: 'Private Customer',
    priceConditions: {
      touchUp:         { value: '', active: false },
      std1BR:          { value: '', active: false },
      std2BR:          { value: '', active: false },
      std3BR:          { value: '', active: false },
      deepCleanFee:    { value: '', active: false },
      hdcFee:          { value: '', active: false },
      office:          { value: '', frequency: 'Weekly',   active: false },
      officeAlt:       { value: '', frequency: 'Biweekly', active: false },
      cancellationFee: { value: '', active: false },
      inspectionFee:   { value: '', active: false },
    },
  },
  {
    name: 'Other',
    priceConditions: {
      touchUp:         { value: '', active: false },
      std1BR:          { value: '', active: false },
      std2BR:          { value: '', active: false },
      std3BR:          { value: '', active: false },
      deepCleanFee:    { value: '', active: false },
      hdcFee:          { value: '', active: false },
      office:          { value: '', frequency: 'Weekly',   active: false },
      officeAlt:       { value: '', frequency: 'Biweekly', active: false },
      cancellationFee: { value: '', active: false },
      inspectionFee:   { value: '', active: false },
    },
  },
]

async function main() {
  console.log('Seeding managements...')
  for (const mgmt of MANAGEMENTS) {
    const existing = await prisma.management.findUnique({ where: { name: mgmt.name } })
    if (existing) {
      console.log(`  ⟳  Skipped (already exists): ${mgmt.name}`)
      continue
    }
    await prisma.management.create({ data: mgmt })
    console.log(`  ✓  Created: ${mgmt.name}`)
  }
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
