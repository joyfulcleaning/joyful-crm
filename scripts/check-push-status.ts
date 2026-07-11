import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: 'notif.' } },
    orderBy: { key: 'asc' },
  })
  console.log('--- Settings notif.* en DB ---')
  for (const s of settings) console.log(`${s.key} = ${s.value}`)
  if (settings.length === 0) console.log('(ninguno guardado — todos los eventos usan el comportamiento por defecto)')

  const tokens = await prisma.pushToken.findMany({
    include: { user: { select: { name: true, role: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  console.log('\n--- Push tokens registrados ---')
  for (const t of tokens) console.log(`${t.user.name} (${t.user.role}) — ${t.token.slice(0, 28)}... actualizado ${t.updatedAt.toISOString().slice(0, 10)}`)
  if (tokens.length === 0) console.log('(no hay dispositivos registrados)')

  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { name: true, email: true } })
  console.log('\n--- Usuarios admin ---')
  for (const a of admins) console.log(`${a.name} <${a.email}>`)
}

main().finally(() => prisma.$disconnect())
