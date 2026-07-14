export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/mobile-auth'
import { signMapKitToken } from '@/lib/mapkit-token'

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = signMapKitToken()
    return NextResponse.json({ token })
  } catch (error) {
    console.error('GET /api/mapkit-token:', error)
    return NextResponse.json({ error: 'Failed to generate map token' }, { status: 500 })
  }
}
