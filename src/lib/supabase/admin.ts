import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service role key.
 * Bypasa RLS — usar solo en código de servidor (API routes, server components).
 * Nunca exponer al cliente.
 */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
