export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import TarifasForm from '@/components/admin/TarifasForm'
import TarifasRangosManager, { type TarifaRango } from '@/components/admin/TarifasRangosManager'
import SincronizarZohoItemsButton from '@/components/admin/SincronizarZohoItemsButton'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdminTarifasPage() {
  const supabase = getSupabaseAdmin()
  const [legacyRes, rangosRes] = await Promise.all([
    supabase.from('categorias_tarifas').select('*').order('nombre_display'),
    supabase.from('tarifas_rangos').select('*').order('categoria').order('prioridad'),
  ])

  const tarifasLegacy = legacyRes.data ?? []
  const tarifasRangos = (rangosRes.data ?? []) as TarifaRango[]

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tarifas</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Sistema con dos modelos: <strong className="text-white/70">tarifas escalonadas</strong> (con condiciÃ³n, cantidad y rangos
            de valor) y <strong className="text-white/70">tarifas legacy</strong> (precio simple por libra o por unidad).
            El cÃ¡lculo prioriza siempre las escalonadas si existen para la categorÃ­a.
          </p>
        </div>
        <SincronizarZohoItemsButton />
      </div>

      <TarifasRangosManager tarifas={tarifasRangos} />

      <div className="pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Tarifas legacy (fallback)</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Aplica solo si la categorÃ­a no tiene tarifas escalonadas configuradas arriba.
          </p>
        </div>
        <TarifasForm tarifas={tarifasLegacy} />
      </div>
    </div>
  )
}
