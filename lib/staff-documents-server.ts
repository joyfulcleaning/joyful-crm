import { supabaseAdmin } from './supabase'
import { DOCUMENTS_BUCKET } from './staff-documents'

const MAX_FILE_BYTES = 25 * 1024 * 1024

// Private on purpose: these are I-9s, IDs and tax forms. Files are only ever
// reached through short-lived signed URLs handed out to admins. Checked once per
// instance, and forced back to private if anyone ever flips it.
let bucketReady: Promise<void> | null = null

export function ensureDocumentsBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = supabaseAdmin()
      const { data } = await admin.storage.getBucket(DOCUMENTS_BUCKET)
      if (!data) {
        const { error } = await admin.storage.createBucket(DOCUMENTS_BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES })
        if (error) throw error
      } else if (data.public) {
        const { error } = await admin.storage.updateBucket(DOCUMENTS_BUCKET, { public: false, fileSizeLimit: MAX_FILE_BYTES })
        if (error) throw error
      }
    })().catch(err => {
      bucketReady = null
      throw err
    })
  }
  return bucketReady
}
