import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Auth for the /api/ai/* namespace (tools called by the Vapi voice assistant).
 * Separate from session/mobile auth — a single shared secret (AI_API_KEY) that
 * is configured as a header on each Tool definition in the Vapi dashboard.
 */
export function isAiAuthorized(request: Request): boolean {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) return false

  const authHeader = request.headers.get('authorization') || ''
  return authHeader === `Bearer ${apiKey}`
}

/**
 * Auth for Retell's `call_analyzed` webhook event (app/api/ai/retell-webhook).
 * Retell signs this delivery itself rather than letting us set a custom
 * header, so it can't reuse isAiAuthorized()'s bearer-token check — instead
 * it sends `x-retell-signature: v={timestampMs},d={hex HMAC-SHA256 digest}`,
 * where the digest covers `rawBody + timestampMs` keyed with the Retell
 * account API key (docs.retellai.com/features/secure-webhook). Must be
 * checked against the raw request body text, not a re-stringified object —
 * any change in key order/whitespace would change the digest.
 */
export function isRetellSignatureValid(rawBody: string, signatureHeader: string | null): boolean {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey || !signatureHeader) return false

  const match = signatureHeader.match(/^v=(\d+),d=([0-9a-f]+)$/)
  if (!match) return false
  const [, timestamp, digest] = match

  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false

  const expected = createHmac('sha256', apiKey).update(rawBody + timestamp).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const digestBuf = Buffer.from(digest)
  if (expectedBuf.length !== digestBuf.length) return false
  return timingSafeEqual(expectedBuf, digestBuf)
}
