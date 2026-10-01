export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase'
import { getAuthUser } from '@/lib/mobile-auth'
import { assertUserCanAccess } from '@/lib/serviceVisibility'

/**
 * Hands back a short-lived URL the client uploads the file straight to, so the
 * bytes never pass through this function.
 *
 * Vercel rejects any request body at or above ~4.5 MB with
 * FUNCTION_PAYLOAD_TOO_LARGE, which a single iPhone photo clears easily — that
 * was the "Could not upload photo" staff were hitting. Routing the file direct
 * to storage removes the ceiling entirely; only this small JSON request and the
 * confirmation that follows go through the serverless function.
 *
 * The client then POSTs `{ storagePath, type }` back to ../photos to create the
 * row, which is where the bucket path is validated again.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (authUser.role === 'user' && !(await assertUserCanAccess(id, authUser.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = await prisma.service.findUnique({ where: { id }, select: { id: true } })
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json().catch(() => null)
    const type = typeof body?.type === 'string' ? body.type : 'before'
    const fileName = typeof body?.fileName === 'string' ? body.fileName : 'photo.jpg'

    // Keep the same shape the direct-upload path produced, random suffix
    // included so a batch can't collide inside one millisecond.
    const ext = (fileName.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg'
    const suffix = Math.random().toString(36).slice(2, 8)
    const storagePath = `${id}/${type}/${Date.now()}-${suffix}.${ext}`

    const { data, error } = await supabaseAdmin()
      .storage.from(PHOTOS_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('createSignedUploadUrl error:', error)
      return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: data.signedUrl, storagePath })
  } catch (error) {
    console.error('POST /api/services/[id]/photos/upload-url:', error)
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
  }
}
