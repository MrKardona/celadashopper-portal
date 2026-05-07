import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// GET /api/auth/callback
// Soporta los flujos de auth de Supabase:
//
//  1. PKCE: ?code=xxx
//     Intercambiamos el código SERVER-SIDE usando el code_verifier que
//     @supabase/ssr almacena en una cookie (no en localStorage).
//     Esto resuelve el problema en móvil donde el app de correo (Gmail,
//     Outlook, Apple Mail) abre el link en su propio webview — como las
//     cookies del sistema se comparten (Chrome Custom Tabs / SFSafariViewController),
//     el server puede completar el intercambio sin depender del browser del usuario.
//     Si el intercambio server-side falla (edge case: webview aislado),
//     enviamos el code al browser como fallback.
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

  // ── Caso B: PKCE (?code=...) ─ intercambiar SERVER-SIDE ──────────────────
  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Éxito: sesión establecida vía cookie, redirigir al destino final
      return response
    }

    // Fallback: el verifier no estaba en la cookie (webview aislado).
    // Enviamos el code al browser para que intente el intercambio client-side.
    console.warn('[auth/callback] server-side exchange falló, intentando browser-side:', error.message)
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
