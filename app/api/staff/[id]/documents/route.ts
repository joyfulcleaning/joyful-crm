export const dynamic = 'force-dynamic'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase'
import { parseDateOnly } from '@/lib/staff-profile-server'
import { DOCUMENTS_BUCKET, STAFF_DOCUMENTS } from '@/lib/staff-documents'
import { ensureDocumentsBucket } from '@/lib/staff-documents-server'

const DOC_TYPES = new Set([...STAFF_DOCUMENTS.map(d => d.key), 'other'])

// Two steps, like service photos: `{ prepare: true, fileName }` returns a signed
// URL the browser uploads the file straight to (Vercel caps request bodies near
// 4.5 MB), then a second call with the resulting storagePath creates the row.
// A row with no file at all records a paper document as received.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const person = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()

    if (body.prepare) {
      await ensureDocumentsBucket()
      const name = typeof body.fileName === 'string' ? body.fileName : 'document'
      const ext = (name.includes('.') ? name.split('.').pop()! : 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'bin'
      const storagePath = `${id}/${crypto.randomUUID()}.${ext}`
      const { data, error } = await supabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(storagePath)
      if (error || !data) {
        console.error('createSignedUploadUrl error:', error)
        return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
      }
      return NextResponse.json({ uploadUrl: data.signedUrl, storagePath })
    }

    if (!DOC_TYPES.has(body.docType)) return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
    if (body.docType === 'other' && !body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    // Only paths this route handed out for this same person.
    if (body.storagePath && !new RegExp(`^${id}/[0-9a-f-]{36}\\.[a-zA-Z0-9]{1,5}$`).test(body.storagePath)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    const document = await prisma.staffDocument.create({
      data: {
        userId:       id,
        docType:      body.docType,
        title:        body.title?.trim() || null,
        storagePath:  body.storagePath || null,
        fileName:     body.storagePath ? String(body.fileName || '').slice(0, 200) || null : null,
        mimeType:     body.storagePath ? String(body.mimeType || '').slice(0, 100) || null : null,
        sizeBytes:    body.storagePath && Number.isFinite(Number(body.sizeBytes)) ? Number(body.sizeBytes) : null,
        issuedAt:     parseDateOnly(body.issuedAt),
        expiresAt:    parseDateOnly(body.expiresAt),
        note:         body.note?.trim() || null,
        uploadedById: authUser.id,
      },
    })

    logAudit(authUser, 'create', 'staffDocument', document.id, {
      staffId: id, docType: document.docType, withFile: !!document.storagePath,
    })
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error saving staff document:', error)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }
}
