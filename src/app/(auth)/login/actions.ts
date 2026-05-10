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
    // No exponer el mensaje exacto si el email no existe (prevenir enumeración)
    if (error.message.toLowerCase().includes('signups not allowed')) {
      return { error: 'Este correo no tiene una cuenta registrada. Contacta al administrador.' }
    }
    return { error: 'No se pudo enviar el link. Intenta de nuevo.' }
  }

  return { error: null }
}
