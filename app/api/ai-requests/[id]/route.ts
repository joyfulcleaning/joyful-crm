export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'
import { resolveAiRequest, saveAiRequestDraft } from '@/lib/ai-requests'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    // action "save" keeps the request pending — it only persists what staff
    // has typed so far. Everything else resolves it.
    const { status, body: result } = body?.action === 'save'
      ? await saveAiRequestDraft(id, body)
      : await resolveAiRequest(id, body, authUser.id)
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('PATCH /api/ai-requests/[id] error:', error)
    return NextResponse.json({ error: 'Failed to resolve AI request' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    await prisma.aiRequest.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/ai-requests/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete AI request' }, { status: 500 })
  }
}
