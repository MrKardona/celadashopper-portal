import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** Roles con acceso al panel de administración. */
export const ADMIN_ROLES = ['admin', 'agente_usa'] as const
export type AdminRol = (typeof ADMIN_ROLES)[number]

/**
 * Verifica que el usuario autenticado tenga rol de admin o agente_usa.
 * Devuelve el objeto `user` si tiene acceso, o `null` si no.
 *
 * Uso en API routes:
 * ```ts
 * const user = await verificarAdmin()
 * if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
 * ```
 */
export async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!ADMIN_ROLES.includes(perfil?.rol as AdminRol)) return null
  return user
}
