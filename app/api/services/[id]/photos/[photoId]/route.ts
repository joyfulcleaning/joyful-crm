export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase'
import { getAuthUser } from '@/lib/mobile-auth'
import { assertUserCanAccess } from '@/lib/serviceVisibility'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const authUser = await getAuthUser(_req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, photoId } = await params

    // Staff may only touch services assigned to them — same gate the GET and
    // POST on this resource already apply.
    if (authUser.role === 'user' && !(await assertUserCanAccess(id, authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const photo = await prisma.servicePhoto.findUnique({ where: { id: photoId } })
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // The photo has to actually belong to the service in the path, or the
    // check above proves nothing: any id would authorise deleting any photo.
    if (photo.serviceId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
