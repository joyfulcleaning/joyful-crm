export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { cancelSupplyRequest, fulfillSupplyRequest, rejectSupplyRequest } from '@/lib/supply-requests'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    // Cancelling is the staff member's own action on their own request;
    // dispatching and declining move stock, so they're admin-only.
    if (body?.action === 'cancel') {
      const { status, body: result } = await cancelSupplyRequest(id, authUser)
      return NextResponse.json(result, { status })
    }

    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only an admin can dispatch or decline a request' }, { status: 403 })
    }

    const { status, body: result } = body?.action === 'reject'
      ? await rejectSupplyRequest(id, authUser, body)
      : await fulfillSupplyRequest(id, authUser, body)
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('PATCH /api/supply-requests/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update the supply request' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only an admin can delete a request' }, { status: 403 })
    }

    const { id } = await context.params
    // Deleting only drops the paper trail of the request — the stock movements
    // it created stay in the inventory history, where they belong.
    await prisma.supplyRequest.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/supply-requests/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete the supply request' }, { status: 500 })
  }
}
