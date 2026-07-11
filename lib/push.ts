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

    // Expo caps each request at 100 messages; batch and collect per-message
    // tickets so tokens Expo reports as dead get pruned instead of silently
    // eating every future notification for that device.
    const stale: string[] = []
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100)
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk.map(t => ({ to: t.token, title, body, data: data || {} }))),
      })
      const json = await res.json().catch(() => null)
      const tickets = json?.data
      if (Array.isArray(tickets)) {
        tickets.forEach((ticket: any, j: number) => {
          if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
            stale.push(chunk[j].token)
          } else if (ticket?.status === 'error') {
            console.error(`Push ticket error for event "${eventKey}":`, ticket?.message || ticket)
          }
        })
      }
    }
    if (stale.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: stale } } })
    }
  } catch (err) {
    console.error(`Error sending push for event "${eventKey}":`, err)
  }
}
