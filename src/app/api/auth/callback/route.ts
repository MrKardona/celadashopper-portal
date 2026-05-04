import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// GET /api/auth/callback
// Soporta los flujos de auth de Supabase:
//
//  1. PKCE: ?code=xxx
//     El code_verifier solo está en el navegador del usuario (localStorage)
//     → REENVIAMOS al browser preservando el code para que el SDK haga
//       exchangeCodeForSession con su verifier local. Esto es vital para
//       resistir scanners de email (Outlook, Gmail) que consumirían el
//       token si lo intercambiáramos en el server.
//
//  2. OTP legacy: ?token_hash=xxx&type=recovery|signup|magiclink|invite
//     Se puede verificar server-side con verifyOtp.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const errorParam = searchParams.get('error') ?? searchParams.get('error_code')
  const next = searchParams.get('next') ?? '/dashboard'

  // ── Caso A: error explícito de Supabase (token expirado, etc.) ────────────
  if (errorParam) {
    console.error('[auth/callback] error de Supabase:', errorParam)
    const errorDest = next === '/nueva-contrasena' ? '/recuperar?error=expired' : '/login?error=auth'
    return NextResponse.redirect(`${origin}${errorDest}`)
  }

  // ── Caso B: PKCE (?code=...) ─ reenviar al browser preservando el code ───
  if (code) {
    // El destino final mantiene el ?code=... para que el SDK del browser
    // pueda intercambiarlo con su code_verifier de localStorage.
    const dest = new URL(`${origin}${next}`)
    dest.searchParams.set('code', code)
    return NextResponse.redirect(dest)
  }

  // ── Caso C: OTP legacy (?token_hash=...&type=...) ─ verificar server-side ─
  if (tokenHash && type) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return response
    console.error('[auth/callback] verifyOtp falló:', error.message, 'type=', type)
  }

  // ── Sin parámetros válidos ────────────────────────────────────────────────
  const errorDest = next === '/nueva-contrasena' ? '/recuperar?error=expired' : '/login?error=auth'
  return NextResponse.redirect(`${origin}${errorDest}`)
}
