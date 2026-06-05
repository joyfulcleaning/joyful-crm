export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { photoId } = await params
    const photo = await prisma.servicePhoto.findUnique({ where: { id: photoId } })
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Extract storage path from public URL
    const urlObj = new URL(photo.url)
    const storagePath = urlObj.pathname.split(`/${PHOTOS_BUCKET}/`)[1]
    if (storagePath) {
      await supabaseAdmin().storage.from(PHOTOS_BUCKET).remove([storagePath])
    }

    await prisma.servicePhoto.delete({ where: { id: photoId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/services/[id]/photos/[photoId] error:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
