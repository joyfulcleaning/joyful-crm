// ─── Private Customer management identifier ────────────────────────────────────
export const PRIVATE_CUSTOMER_NAME = 'Private Customer'

// Types that drive auto-pricing from management conditions
export const AUTO_PRICE_TYPES = new Set(['Standard Clean', 'Deep Clean', 'Heavy Deep Clean', 'Office Clean'])

// Maps room size option to the priceConditions key
export const ROOM_TO_KEY: Record<string, string> = {
  '1BR': 'std1BR',
  '2BR': 'std2BR',
  '3BR': 'std3BR',
}

// ─── Price calculation from management conditions ─────────────────────────────
export function calcPrices(client: any, type: string, roomSize: string) {
  const conds = client?.management?.priceConditions
  if (!conds) return null

  // Resolve base (STD) price for the room size
  const stdKey = ROOM_TO_KEY[roomSize]
  const stdPrice = stdKey && conds[stdKey]?.active && conds[stdKey]?.value
    ? parseFloat(conds[stdKey].value)
    : null

  // Resolve office price
  const officePrice = conds.office?.active && conds.office?.value
    ? parseFloat(conds.office.value)
    : conds.officeAlt?.active && conds.officeAlt?.value
    ? parseFloat(conds.officeAlt.value)
    : null

  if (type === 'Standard Clean') {
    if (roomSize === 'Office/Amenities') return officePrice != null ? { base: officePrice, fee: 0 } : null
    return stdPrice != null ? { base: stdPrice, fee: 0 } : null
  }

  if (type === 'Deep Clean') {
    if (stdPrice == null) return null
    const fee = conds.deepCleanFee?.active && conds.deepCleanFee?.value
      ? parseFloat(conds.deepCleanFee.value) : 0
    return { base: stdPrice, fee }
  }

  if (type === 'Heavy Deep Clean') {
    if (stdPrice == null) return null
    const fee = conds.hdcFee?.active && conds.hdcFee?.value
      ? parseFloat(conds.hdcFee.value) : 0
    return { base: stdPrice, fee }
  }

  if (type === 'Office Clean') {
    return officePrice != null ? { base: officePrice, fee: 0 } : null
  }

  return null
}

export function calcPrivatePrices(client: any, frequency: string) {
  const priceRef = client?.priceRef
  if (!priceRef || frequency === 'one_time') return null
  const price = priceRef[frequency] ? parseFloat(priceRef[frequency]) : null
  return price != null ? { base: price, fee: 0 } : null
}

// ─── Post-construction estimate, priced per square foot ───────────────────────
export const SQFT_RATES: Record<string, number> = {
  'Rough Clean': 0.35,
  'Final Clean': 0.45,
  'Touch Up':    0.25,
}

export function calcSqftEstimate(type: string, sqft: number) {
  const rate = SQFT_RATES[type]
  if (rate == null || !(sqft > 0)) return null
  return Math.round(rate * sqft * 100) / 100
}
