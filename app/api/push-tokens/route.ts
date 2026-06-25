export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: authUser.id },
      create: { token, userId: authUser.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/push-tokens error:', error)
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

    await prisma.pushToken.deleteMany({ where: { token, userId: authUser.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/push-tokens error:', error)
    return NextResponse.json({ error: 'Failed to remove push token' }, { status: 500 })
  }
}
