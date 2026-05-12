import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Bike, LogOut } from 'lucide-react'
import LogoutButton from '@/components/domiciliario/LogoutButton'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DomiciliarioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre_completo, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'domiciliario') redirect('/dashboard')

  const nombre = perfil.nombre_completo?.split(' ')[0] ?? 'Domiciliario'

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #07070f 0%, #0b0b1d 40%, #080c14 100%)',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14"
        style={{
          background: 'rgba(8,8,20,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)' }}>
          <Bike className="h-4 w-4" style={{ color: '#818cf8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-none">Mis entregas</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{perfil.nombre_completo}</p>
        </div>
        <LogoutButton />
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto">
        {children}
      </main>
    </div>
  )
}
