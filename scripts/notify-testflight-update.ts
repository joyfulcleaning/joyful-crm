import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Sends a "new update available" push to every registered device, regardless
// of role — used after every new build lands in TestFlight so the whole team
// knows to update.
async function main() {
  const tokens = await prisma.pushToken.findMany({
    include: { user: { select: { name: true, role: true } } },
  })
  if (tokens.length === 0) {
    console.log('No hay dispositivos registrados.')
    return
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map(t => ({
      to: t.token,
      title: '🔄 Actualización disponible',
      body: 'Hay una nueva versión de Joyful CRM en TestFlight. Abre TestFlight para actualizar.',
      data: { type: 'appUpdateAvailable' },
      sound: 'default',
      priority: 'high',
      channelId: 'alerts_v2',
    }))),
  })
  const json: any = await res.json()
  const tickets = json?.data ?? []
  tokens.forEach((t, i) => {
    const ticket = tickets[i]
    const state = ticket?.status === 'ok'
      ? 'OK'
      : `ERROR: ${ticket?.details?.error ?? ticket?.message ?? JSON.stringify(ticket)}`
    console.log(`${t.user.name} (${t.user.role}) — ${t.token.slice(0, 28)}... -> ${state}`)
  })
}

main().finally(() => prisma.$disconnect())
