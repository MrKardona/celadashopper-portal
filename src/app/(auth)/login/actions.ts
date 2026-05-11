'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// ── Login con contraseña para admins ─────────────────────────────────────────
export async function iniciarSesionAdmin(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error || !data.user) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  // Verificar que el usuario tiene rol admin o agente_usa
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', data.user.id)
    .single()

  if (!perfil || !['admin', 'agente_usa'].includes(perfil.rol ?? '')) {
    await supabase.auth.signOut()
    return { error: 'Esta cuenta no tiene acceso de administrador.' }
  }

  return { error: null }
}

// ── Recuperar contraseña para admins ─────────────────────────────────────────
export async function recuperarContrasenaAdmin(
  email: string,
): Promise<{ error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase()

  // Verificar que el correo pertenece a un admin o agente_usa
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (!perfil || !['admin', 'agente_usa'].includes(perfil.rol ?? '')) {
    return { error: 'No tienes permisos suficientes para solicitar recuperación de contraseña.' }
  }

  const supabase = await createClient()
  const headersList = await headers()

  const origin =
    headersList.get('origin') ??
    headersList.get('referer')?.replace(/\/[^/]*$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://portal.celadashopper.com'

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    { redirectTo: `${origin}/api/auth/callback?next=/nueva-contrasena` },
  )

  if (error) {
    console.error('[recuperarContrasenaAdmin]', error.message)
  }

  // Responder OK (no revelar si el email existe en Auth)
  return { error: null }
}

// ── Magic link para usuarios normales ────────────────────────────────────────
export async function enviarMagicLink(email: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const headersList = await headers()

  // Determinar el origin del request actual
  const origin =
    headersList.get('origin') ??
    headersList.get('referer')?.replace(/\/[^/]*$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://portal.celadashopper.com'

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      // URL simple sin parámetros anidados para evitar problemas de encoding en emails
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error) {
    console.error('[enviarMagicLink]', error.message)
    const msg = error.message.toLowerCase()
    // Detectar que el usuario no existe → abrir formulario de registro
    if (
      msg.includes('signups not allowed') ||
      msg.includes('signup_disabled') ||
      msg.includes('user not found') ||
      msg.includes('no user found') ||
      msg.includes('invalid login credentials')
    ) {
      return { error: 'Este correo no tiene una cuenta registrada. Puedes crear una.' }
    }
    // Rate limit
    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('after')) {
      return { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }
    }
    return { error: 'No se pudo enviar el link. Intenta de nuevo.' }
  }

  return { error: null }
}
