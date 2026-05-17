import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon       = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let _client: SupabaseClient | null = null
let _serviceClient: SupabaseClient | null = null

/**
 * Public/anon Supabase client. Respects Row Level Security. Use for any
 * data the website displays publicly — events, drinks, gallery, etc.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null
  if (!_client) {
    _client = createClient(url, anon, {
      auth: { persistSession: false },
    })
  }
  return _client
}

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * Server-only — never import from client components. Use for reading
 * sensitive tables (like service_tokens) or admin writes.
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null
  if (!_serviceClient) {
    _serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
  }
  return _serviceClient
}

export const SUPABASE_CONFIGURED = Boolean(url && anon)