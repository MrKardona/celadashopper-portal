export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import PerfilForm from '@/components/portal/PerfilForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Package } from 'lucide-react'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('email, nombre_completo, telefono, whatsapp, ciudad, numero_casilla, direccion, barrio, referencia')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-gray-500 mt-1">
          Mantén tus datos actualizados para recibir notificaciones de tus paquetes.
        </p>
      </div>

      {/* Casilla USA */}
      {perfil?.numero_casilla && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-orange-600 font-medium">Tu número de casilla</p>
                <p className="font-mono font-bold text-orange-800 text-lg">{perfil.numero_casilla}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-orange-600" />
            Información personal
          </CardTitle>
          <CardDescription>
            El correo no se puede cambiar. Para hacerlo, contáctanos por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
