import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const svc  = process.env.SUPABASE_SECRET_KEY!

// Browser-safe client (publishable key)
export const supabaseBrowser = createClient(url, anon)

// Server-only admin client (service-role key — never send to browser)
export function supabaseAdmin() {
  return createClient(url, svc, { auth: { persistSession: false } })
}

export const PHOTOS_BUCKET = 'service-photos'
