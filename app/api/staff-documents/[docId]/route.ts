export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'
import { supabaseAdmin } from '@/lib/supabase'
import { parseDateOnly } from '@/lib/staff-profile-server'
import { DOCUMENTS_BUCKET } from '@/lib/staff-documents'

// Long enough to open the file, short enough that a copied link soon dies.
const VIEW_SECONDS = 120

// A short-lived link to the file. Every view is logged.
export async function GET(
  request: Request,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { docId } = await context.params
    const doc = await prisma.staffDocument.findUnique({ where: { id: docId } })
    if (!doc?.storagePath) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin().storage.from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storagePath, VIEW_SECONDS)
    if (error || !data) {
      console.error('createSignedUrl error:', error)
      return NextResponse.json({ error: 'Could not open file' }, { status: 500 })
    }

    logAudit(authUser, 'update', 'staffDocument', docId, { staffId: doc.userId, docType: doc.docType, viewed: true })
    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Error opening staff document:', error)
    return NextResponse.json({ error: 'Could not open file' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { docId } = await context.params
    const body = await request.json()
    const doc = await prisma.staffDocument.update({
      where: { id: docId },
      data: {
        ...(body.title !== undefined ? { title: body.title?.trim() || null } : {}),
        ...(body.issuedAt !== undefined ? { issuedAt: parseDateOnly(body.issuedAt) } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: parseDateOnly(body.expiresAt) } : {}),
        ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
      },
    })

    logAudit(authUser, 'update', 'staffDocument', docId, { staffId: doc.userId, docType: doc.docType, fields: Object.keys(body) })
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Error updating staff document:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ docId: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { docId } = await context.params
    const doc = await prisma.staffDocument.findUnique({ where: { id: docId } })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.staffDocument.delete({ where: { id: docId } })
    // The row goes first: a file left behind in the private bucket is harmless,
    // a row pointing at a missing file is not.
    if (doc.storagePath) {
      const { error } = await supabaseAdmin().storage.from(DOCUMENTS_BUCKET).remove([doc.storagePath])
      if (error) console.error('Failed to remove staff document file:', error)
    }

    logAudit(authUser, 'delete', 'staffDocument', docId, { staffId: doc.userId, docType: doc.docType })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting staff document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
