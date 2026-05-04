import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // PKCE protege contra que clientes de email (Outlook, Gmail scanners)
        // consuman el one-time token al hacer preview del link.
        // El code_verifier solo está en el navegador del usuario real.
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  )
}
