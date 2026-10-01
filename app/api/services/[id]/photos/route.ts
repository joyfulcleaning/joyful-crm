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

// The bucket's config can't drift within a running instance, so check it once
// instead of on every upload — a twenty-photo batch would otherwise spend
// forty extra round-trips re-asserting the same settings.
let bucketReady: Promise<void> | null = null

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = supabaseAdmin()
      const { data } = await admin.storage.getBucket(PHOTOS_BUCKET)
      if (!data) {
        await admin.storage.createBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: 209715200 })
      } else {
        await admin.storage.updateBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: 209715200 })
      }
    })().catch(err => {
      // Don't cache a failure — the next upload should retry.
      bucketReady = null
      throw err
    })
  }
  return bucketReady
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

    // Two shapes arrive here. A JSON body confirms a file the client already
    // uploaded straight to storage via ../photos/upload-url — the path that
    // isn't capped by Vercel's request size limit. Multipart is the original
    // route-the-bytes-through-here flow, kept for the web and for mobile
    // builds that predate the direct upload.
    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const body = await req.json().catch(() => null)
      const storagePath = typeof body?.storagePath === 'string' ? body.storagePath : ''
      const type = (typeof body?.type === 'string' && body.type) || 'before'

      // The path is client-supplied, so it has to sit inside this service's
      // folder — otherwise a caller could attach any object in the bucket.
      if (!storagePath || !storagePath.startsWith(`${id}/`) || storagePath.includes('..')) {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 })
      }

      const admin = supabaseAdmin()
      // Confirm the object really landed before recording a row that would
      // otherwise render as a broken image forever.
      const folder = storagePath.slice(0, storagePath.lastIndexOf('/'))
      const name   = storagePath.slice(storagePath.lastIndexOf('/') + 1)
      const { data: listed } = await admin.storage.from(PHOTOS_BUCKET).list(folder, { search: name })
      if (!listed?.some(f => f.name === name)) {
        return NextResponse.json({ error: 'Upload not found in storage' }, { status: 400 })
      }

      const { data: urlData } = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath)
      const photo = await prisma.servicePhoto.create({
        data: { serviceId: id, url: urlData.publicUrl, type },
      })
      return NextResponse.json(photo)
    }

    await ensureBucket()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = (formData.get('type') as string) || 'before'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext  = file.name.split('.').pop() ?? 'jpg'
    // A timestamp alone collides when a batch upload lands two files in the
    // same millisecond, and `upsert: false` turns that into a failed photo.
    const suffix = Math.random().toString(36).slice(2, 8)
    const path = `${id}/${type}/${Date.now()}-${suffix}.${ext}`
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
