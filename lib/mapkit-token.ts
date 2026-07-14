import jwt from 'jsonwebtoken'

// Signs a short-lived MapKit JS token server-side. The private key never
// reaches the client — only this signed token does. Apple doesn't let you
// restrict allowed origins in the Developer portal for MapKit JS keys; the
// `origin` claim below is how that restriction actually gets enforced.
export function signMapKitToken(): string {
  const teamId = process.env.APPLE_MAPKIT_TEAM_ID
  const keyId = process.env.APPLE_MAPKIT_KEY_ID
  const privateKey = process.env.APPLE_MAPKIT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const origins = process.env.APPLE_MAPKIT_ALLOWED_ORIGINS

  if (!teamId || !keyId || !privateKey) {
    throw new Error('Apple MapKit is not configured (missing APPLE_MAPKIT_* env vars)')
  }

  return jwt.sign(
    { origin: origins },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
      issuer: teamId,
      expiresIn: '30m',
    }
  )
}
