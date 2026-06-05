import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const rows = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    rows.forEach(r => { map[r.key] = r.value })
    return NextResponse.json(map)
  } catch {
    return NextResponse.json({})
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: Record<string, string> = await request.json()
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
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
