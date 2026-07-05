import { prisma } from './prisma'

// Keys under which payment credentials live in the generic `Setting` table.
// Centralized here so the read path (getPaymentConfig) and the write path
// (the payment-credentials endpoint) always agree on the exact key names.
export const PAYMENT_SETTING_KEYS = {
  stripeSecretKey:           'payments.stripe.secretKey',
  stripeWebhookSecret:       'payments.stripe.webhookSecret',
  squareAccessToken:         'payments.square.accessToken',
  squareLocationId:          'payments.square.locationId',
  squareWebhookSignatureKey: 'payments.square.webhookSignatureKey',
  squareWebhookUrl:          'payments.square.webhookUrl',
  squareEnvironment:         'payments.square.environment',
} as const

export type PaymentConfig = {
  stripeSecretKey?: string
  stripeWebhookSecret?: string
  squareAccessToken?: string
  squareLocationId?: string
  squareWebhookSignatureKey?: string
  squareWebhookUrl?: string
  squareEnvironment?: string
}

/**
 * Reads payment credentials from the Setting table first, falling back to
 * environment variables. DB values let an admin rotate keys from the
 * Settings UI without a deploy; env vars remain a valid path for advanced
 * setups (e.g. a key that should never touch the database at all).
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(PAYMENT_SETTING_KEYS) } },
  })
  const map = new Map(rows.map(r => [r.key, r.value]))

  return {
    stripeSecretKey:           map.get(PAYMENT_SETTING_KEYS.stripeSecretKey)           || process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret:       map.get(PAYMENT_SETTING_KEYS.stripeWebhookSecret)       || process.env.STRIPE_WEBHOOK_SECRET,
    squareAccessToken:         map.get(PAYMENT_SETTING_KEYS.squareAccessToken)         || process.env.SQUARE_ACCESS_TOKEN,
    squareLocationId:          map.get(PAYMENT_SETTING_KEYS.squareLocationId)          || process.env.SQUARE_LOCATION_ID,
    squareWebhookSignatureKey: map.get(PAYMENT_SETTING_KEYS.squareWebhookSignatureKey) || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    squareWebhookUrl:          map.get(PAYMENT_SETTING_KEYS.squareWebhookUrl)          || process.env.SQUARE_WEBHOOK_URL,
    squareEnvironment:         map.get(PAYMENT_SETTING_KEYS.squareEnvironment)         || process.env.SQUARE_ENVIRONMENT,
  }
}
