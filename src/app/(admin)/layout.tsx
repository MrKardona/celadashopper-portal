import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import NavAdmin from '@/components/admin/NavAdmin'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Usar service role para saltar RLS y leer el rol correctamente
  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('nombre_completo, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <NavAdmin nombreAdmin={perfil.nombre_completo} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
