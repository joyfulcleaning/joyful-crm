const BUSINESS_TIMEZONE = 'America/New_York'

/**
 * "Now" expressed as the business's local calendar date, anchored to noon
 * UTC. Use this instead of `new Date()` whenever a DateTime column is meant
 * to record a calendar day (e.g. "paid today") rather than a precise
 * instant — noon UTC survives any timezone the record is later read back
 * in without shifting to the adjacent day. Mirrors how invoice.issuedAt is
 * already set in POST /api/invoices.
 */
export function businessToday(): Date {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })
  return new Date(`${ymd}T12:00:00.000Z`)
}
