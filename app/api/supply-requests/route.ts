export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'
import { createSupplyRequest, listSupplyRequests } from '@/lib/supply-requests'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(await listSupplyRequests(authUser))
  } catch (error) {
    console.error('GET /api/supply-requests error:', error)
    return NextResponse.json({ error: 'Failed to load supply requests' }, { status: 500 })
  }
}

// Any active account can ask for supplies — this is the staff side of the
// feature, and an admin asking for their own stock is harmless.
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { status, body: result } = await createSupplyRequest(authUser, body)
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('POST /api/supply-requests error:', error)
    return NextResponse.json({ error: 'Failed to create the supply request' }, { status: 500 })
  }
}
