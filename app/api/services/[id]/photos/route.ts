import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase'

async function ensureBucket() {
  const admin = supabaseAdmin()
  const { data } = await admin.storage.getBucket(PHOTOS_BUCKET)
  if (!data) {
    await admin.storage.createBucket(PHOTOS_BUCKET, { public: true, fileSizeLimit: 52428800 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { id } = await params
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
