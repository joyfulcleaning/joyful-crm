export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const requests = await prisma.aiRequest.findMany({
      include: { client: { select: { id: true, name: true } }, resolvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(requests)
  } catch (error) {
    console.error('GET /api/ai-requests error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
