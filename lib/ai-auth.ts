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
