export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import PerfilForm from '@/components/portal/PerfilForm'
import { User, Package } from 'lucide-react'
import { FadeUp, FadeUpScroll } from '@/components/portal/AnimateIn'

const tw = 'rgba(255,255,255,'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('email, nombre_completo, telefono, whatsapp, ciudad, numero_casilla, direccion, barrio, referencia')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>

      <FadeUp>
        <div>
          <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
          <p className="mt-1 text-sm" style={{ color: `${tw}0.45)` }}>
            Mantén tus datos actualizados para recibir notificaciones de tus paquetes.
          </p>
        </div>
      </FadeUp>

      {perfil?.numero_casilla && (
        <FadeUp delay={0.08}>
          <div className="glass-card-gold p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,184,0,0.15)' }}>
                <Package className="h-5 w-5" style={{ color: '#F5B800' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: `${tw}0.5)` }}>Tu número de casillero</p>
                <p className="font-mono font-bold text-lg" style={{ color: '#F5B800' }}>{perfil.numero_casilla}</p>
              </div>
            </div>
          </div>
        </FadeUp>
      )}

      <FadeUpScroll delay={0.05}>
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" style={{ color: '#F5B800' }} />
              <h2 className="font-semibold text-white">Información personal</h2>
            </div>
            <p className="text-xs mt-1" style={{ color: `${tw}0.4)` }}>
              El correo no se puede cambiar. Para hacerlo, contáctanos por WhatsApp.
            </p>
          </div>
          <div className="p-5">
            <PerfilForm
              email={perfil?.email ?? ''}
              nombreCompleto={perfil?.nombre_completo ?? ''}
              telefono={perfil?.telefono ?? ''}
              whatsapp={perfil?.whatsapp ?? ''}
              ciudad={perfil?.ciudad ?? ''}
              direccion={perfil?.direccion ?? ''}
              barrio={perfil?.barrio ?? ''}
              referencia={perfil?.referencia ?? ''}
            />
          </div>
        </div>
      </FadeUpScroll>

    </div>
  )
}
