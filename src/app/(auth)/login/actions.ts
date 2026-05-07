'use server'

// Server Action: envía el magic link usando el cliente server-side de Supabase.
// Esto guarda el code_verifier de PKCE en una cookie HTTP seteada por el servidor
// (Set-Cookie header), lo que hace que sea accesible cuando el email app abre
// el link de vuelta en nuestro callback — incluso en Chrome Custom Tabs (Gmail Android)
// y SFSafariViewController (Apple Mail iOS).

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

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
