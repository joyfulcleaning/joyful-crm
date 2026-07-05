/**
 * Local Y-M-D of a Date, read directly off its local getters — never
 * through toISOString() (which converts to UTC first and rolls the
 * calendar day forward once local time + UTC offset crosses midnight,
 * i.e. anything picked/computed in the evening on the US east coast).
 */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
