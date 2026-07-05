export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { isStripeConfigured, isSquareConfigured } from '@/lib/payments'
import { getPaymentConfig } from '@/lib/payment-config'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    // payments.* rows hold Stripe/Square secrets — never forward their raw
    // value here, no matter who's asking. Only a computed connected flag ships.
    rows.forEach(r => { if (!r.key.startsWith('payments.')) map[r.key] = r.value })
    map['integration.stripe.connected'] = String(await isStripeConfigured())
    map['integration.square.connected'] = String(await isSquareConfigured())
    // Not a secret (just "sandbox" or "production") — safe to surface directly,
    // unlike the actual Square/Stripe credentials.
    const { squareEnvironment } = await getPaymentConfig()
    map['integration.square.environment'] = squareEnvironment === 'production' ? 'production' : 'sandbox'
    return NextResponse.json(map)
  } catch (error) {
    console.error('GET /api/settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: Record<string, string> = await request.json()
    // Payment credentials only go through the admin-gated, write-only
    // /api/settings/payment-credentials endpoint — never through this one.
    const entries = Object.entries(body).filter(([key]) => !key.startsWith('payments.'))
    await Promise.all(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
