import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import NavAdmin from '@/components/admin/NavAdmin'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabaseAdmin = getSupabaseAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Usar service role para saltar RLS y leer el rol correctamente
  const [perfilRes, listosRes] = await Promise.all([
    supabaseAdmin.from('perfiles').select('nombre_completo, rol').eq('id', user.id).single(),
    supabaseAdmin.from('paquetes').select('id', { count: 'exact', head: true })
      .in('estado', ['en_bodega_local', 'en_camino_cliente'])
      .eq('visible_cliente', true)
      .is('paquete_origen_id', null),
  ])

  const perfil = perfilRes.data
  if (!perfil || perfil.rol !== 'admin') redirect('/dashboard')

  const badges = { listosEntrega: listosRes.count ?? 0 }

  return (
    <div className="portal-bg h-screen overflow-hidden flex" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <NavAdmin nombreAdmin={perfil.nombre_completo} badges={badges} />
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'linear-gradient(135deg, #07070f 0%, #0b0b1d 40%, #080c14 100%)' }}>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
