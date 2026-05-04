import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// GET /api/auth/callback
// Soporta los 2 formatos de email de Supabase Auth:
//  1. PKCE: ?code=xxx          → exchangeCodeForSession
//  2. OTP : ?token_hash=xxx&type=recovery|signup|magiclink|invite|email_change → verifyOtp
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  // Crear response de redirección de antemano para adjuntar cookies de sesión
  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── Caso 1: PKCE flow (?code=...) ──────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
    console.error('[auth/callback] exchangeCodeForSession falló:', error.message)
  }

  // ── Caso 2: OTP / verifyOtp (?token_hash=...&type=...) ─────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return response
    console.error('[auth/callback] verifyOtp falló:', error.message, 'type=', type)
  }

  // ── Si nada funcionó, redirigir con error visible ──────────────────────────
  const errorDest = next === '/nueva-contrasena'
    ? '/recuperar?error=expired'
    : '/login?error=auth'
  return NextResponse.redirect(`${origin}${errorDest}`)
}
