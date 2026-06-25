export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'
import { resolveAiRequest } from '@/lib/ai-requests'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    const { status, body: result } = await resolveAiRequest(id, body, authUser.id)
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('PATCH /api/ai-requests/[id] error:', error)
    return NextResponse.json({ error: 'Failed to resolve AI request' }, { status: 500 })
  }
}
