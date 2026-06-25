import { prisma } from '@/lib/prisma'

// Sends a push notification to every registered device belonging to a user
// whose role is allowed for this event, per the Setting keys
// `notif.{eventKey}.push` ("true"/"false") and `notif.{eventKey}.roles`
// (comma-separated, e.g. "admin,user"). Configured from Settings →
// Notifications. Uses Expo's public push API directly — no credentials
// needed, just valid ExponentPushToken values from registered devices.
export async function sendPushToRoles(eventKey: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const [pushSetting, rolesSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: `notif.${eventKey}.push` } }),
      prisma.setting.findUnique({ where: { key: `notif.${eventKey}.roles` } }),
    ])
    if (pushSetting?.value !== 'true') return

    const roles = (rolesSetting?.value || 'admin').split(',').map(r => r.trim()).filter(Boolean)
    if (roles.length === 0) return

    const tokens = await prisma.pushToken.findMany({
      where: { user: { role: { in: roles as any } } },
      select: { token: true },
    })
    if (tokens.length === 0) return

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map(t => ({ to: t.token, title, body, data: data || {} }))),
    })
  } catch (err) {
    console.error(`Error sending push for event "${eventKey}":`, err)
  }
}
