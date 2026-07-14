export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { haversineMeters } from '@/lib/geo'

const LAT_KEY = 'businessPhone.lat'
const LNG_KEY = 'businessPhone.lng'
const UPDATED_KEY = 'businessPhone.updatedAt'
const ARRIVED_KEY = 'businessPhone.arrivedAt'

// How close a new ping needs to be to the previous one to count as "still
// at the same spot" rather than "moved on" — generous enough to absorb
// normal GPS drift/walking around a property, not a whole trip's worth.
const SAME_SPOT_RADIUS_METERS = 120

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await prisma.setting.findMany({ where: { key: { in: [LAT_KEY, LNG_KEY, UPDATED_KEY, ARRIVED_KEY] } } })
    const map: Record<string, string> = {}
    rows.forEach(r => { map[r.key] = r.value })

    if (!map[LAT_KEY] || !map[LNG_KEY]) return NextResponse.json(null)

    return NextResponse.json({
      lat: Number(map[LAT_KEY]),
      lng: Number(map[LNG_KEY]),
      updatedAt: map[UPDATED_KEY] || null,
      arrivedAt: map[ARRIVED_KEY] || map[UPDATED_KEY] || null,
    })
  } catch (error) {
    console.error('GET /api/business-phone-location:', error)
    return NextResponse.json({ error: 'Failed to load location' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { lat, lng } = await request.json()
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 })
    }

    const prevRows = await prisma.setting.findMany({ where: { key: { in: [LAT_KEY, LNG_KEY, ARRIVED_KEY] } } })
    const prevMap: Record<string, string> = {}
    prevRows.forEach(r => { prevMap[r.key] = r.value })

    const now = new Date()
    const updatedAt = now.toISOString()

    // Same spot as the last ping → keep the original arrival time so
    // "how long has the team been here" counts from when they actually
    // arrived, not from the most recent ping. Moved elsewhere → this is a
    // fresh arrival.
    let arrivedAt = updatedAt
    if (prevMap[LAT_KEY] && prevMap[LNG_KEY]) {
      const movedMeters = haversineMeters(Number(prevMap[LAT_KEY]), Number(prevMap[LNG_KEY]), lat, lng)
      if (movedMeters <= SAME_SPOT_RADIUS_METERS && prevMap[ARRIVED_KEY]) {
        arrivedAt = prevMap[ARRIVED_KEY]
      }
    }

    await Promise.all([
      prisma.setting.upsert({ where: { key: LAT_KEY }, update: { value: String(lat) }, create: { key: LAT_KEY, value: String(lat) } }),
      prisma.setting.upsert({ where: { key: LNG_KEY }, update: { value: String(lng) }, create: { key: LNG_KEY, value: String(lng) } }),
      prisma.setting.upsert({ where: { key: UPDATED_KEY }, update: { value: updatedAt }, create: { key: UPDATED_KEY, value: updatedAt } }),
      prisma.setting.upsert({ where: { key: ARRIVED_KEY }, update: { value: arrivedAt }, create: { key: ARRIVED_KEY, value: arrivedAt } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/business-phone-location:', error)
    return NextResponse.json({ error: 'Failed to save location' }, { status: 500 })
  }
}
