export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { User } from 'lucide-react'
import PerfilDomiciliarioForm from '@/components/domiciliario/PerfilDomiciliarioForm'

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function PerfilDomiciliarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre_completo, email, whatsapp, telefono, ciudad, direccion, barrio, referencia, rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'domiciliario') redirect('/dashboard')

  const tw = 'rgba(255,255,255,'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="h-6 w-6" style={{ color: '#818cf8' }} />
          Mi perfil
        </h1>
        <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
          Tus datos personales y de contacto
        </p>
      </div>

      {/* Info read-only card */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${tw}0.25)` }}>
          Cuenta
        </p>
        <div className="space-y-2">
          <div>
            <p className="text-xs" style={{ color: `${tw}0.35)` }}>Correo electrónico</p>
            <p className="text-sm text-white font-medium mt-0.5">{user.email}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: `${tw}0.35)` }}>Rol</p>
            <p className="text-sm mt-0.5 px-2 py-0.5 rounded-full inline-block text-xs font-bold"
              style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}>
              Domiciliario
            </p>
          </div>
        </div>
      </div>

      {/* Editable form */}
      <PerfilDomiciliarioForm perfil={{
        nombre_completo: perfil?.nombre_completo ?? '',
        whatsapp: perfil?.whatsapp ?? '',
        telefono: perfil?.telefono ?? '',
        ciudad: perfil?.ciudad ?? '',
        direccion: perfil?.direccion ?? '',
        barrio: perfil?.barrio ?? '',
        referencia: perfil?.referencia ?? '',
      }} />

    </div>
  )
}
