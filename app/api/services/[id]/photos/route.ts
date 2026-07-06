export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase'
import { getAuthUser } from '@/lib/mobile-auth'
import { getVisibleServiceDates } from '@/lib/serviceVisibility'

async function assertUserCanAccess(serviceId: string, userId: string) {
  const visibility = await getVisibleServiceDates(userId)
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      ...(visibility.unrestricted ? {} : { serviceDate: { in: visibility.dates.map(d => new Date(d)) } }),
      staff: { some: { userId } },
    },
    select: { id: true },
  })
  return !!service
}

async function ensureBucket() {
  const admin = supabaseAdmin()
  const { data } = await admin.storage.getBucket(PHOTOS_BUCKET)
  if (!data) {
    await admin.storage.createBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: 209715200 })
  } else {
    await admin.storage.updateBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: 209715200 })
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    if (authUser.role === 'user' && !(await assertUserCanAccess(id, authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const photos = await prisma.servicePhoto.findMany({
      where: { serviceId: id },
      orderBy: { uploadedAt: 'asc' },
    })
    return NextResponse.json(photos)
  } catch (error) {
    console.error('GET /api/services/[id]/photos error:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    if (authUser.role === 'user' && !(await assertUserCanAccess(id, authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureBucket()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'before'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${id}/${type}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const admin = supabaseAdmin()
    const { error: uploadError } = await admin.storage
      .from(PHOTOS_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(path)

    const photo = await prisma.servicePhoto.create({
      data: { serviceId: id, url: urlData.publicUrl, type },
    })

    return NextResponse.json(photo)
  } catch (error) {
    console.error('POST /api/services/[id]/photos error:', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}
