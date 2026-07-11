import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// One-off delivery test: sends a clearly-labeled test push to every admin
// device and prints Expo's per-token ticket so dead tokens are visible.
async function main() {
  const tokens = await prisma.pushToken.findMany({
    where: { user: { role: 'admin' } },
    include: { user: { select: { name: true } } },
  })
  if (tokens.length === 0) {
    console.log('No hay dispositivos admin registrados.')
    return
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map(t => ({
      to: t.token,
      title: '🔔 Prueba de notificaciones',
      body: 'Test del sistema de push — puedes ignorar este mensaje.',
      data: { type: 'test' },
    }))),
  })
  const json: any = await res.json()
  const tickets = json?.data ?? []
  tokens.forEach((t, i) => {
    const ticket = tickets[i]
    const state = ticket?.status === 'ok'
      ? 'OK (aceptado por Expo)'
      : `ERROR: ${ticket?.details?.error ?? ticket?.message ?? JSON.stringify(ticket)}`
    console.log(`${t.user.name} — ${t.token.slice(0, 28)}... → ${state}`)
  })
}

main().finally(() => prisma.$disconnect())
