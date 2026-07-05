export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { PAYMENT_SETTING_KEYS, getPaymentConfig } from '@/lib/payment-config'

// Reveal-on-demand: an admin can fetch the actual saved values (e.g. to
// re-check a key while testing), but this never happens implicitly — the
// Settings → Integrations page only calls this when the admin clicks
// "View saved values", not on page load.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRateLimit(`payment-creds-view:${authUser.id}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests, try again later' }, { status: 429 })
    }

    const config = await getPaymentConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error('GET /api/settings/payment-credentials:', error)
    return NextResponse.json({ error: 'Failed to load credentials' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: Record<string, string> = await request.json()
    const fieldMap: Record<string, string> = {
      stripeSecretKey:           PAYMENT_SETTING_KEYS.stripeSecretKey,
      stripeWebhookSecret:       PAYMENT_SETTING_KEYS.stripeWebhookSecret,
      squareAccessToken:         PAYMENT_SETTING_KEYS.squareAccessToken,
      squareLocationId:          PAYMENT_SETTING_KEYS.squareLocationId,
      squareWebhookSignatureKey: PAYMENT_SETTING_KEYS.squareWebhookSignatureKey,
      squareWebhookUrl:          PAYMENT_SETTING_KEYS.squareWebhookUrl,
      squareEnvironment:         PAYMENT_SETTING_KEYS.squareEnvironment,
    }

    // Only touch fields that were actually submitted with a non-empty value,
    // so re-saving the Square location ID doesn't require re-pasting the
    // Stripe secret key too.
    const updates = Object.entries(fieldMap)
      .filter(([formKey]) => typeof body[formKey] === 'string' && body[formKey].trim() !== '')
      .map(([formKey, settingKey]) =>
        prisma.setting.upsert({
          where: { key: settingKey },
          update: { value: body[formKey].trim() },
          create: { key: settingKey, value: body[formKey].trim() },
        })
      )

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No values provided' }, { status: 400 })
    }

    await Promise.all(updates)
    return NextResponse.json({ ok: true, updated: updates.length })
  } catch (error) {
    console.error('POST /api/settings/payment-credentials:', error)
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
  }
}
