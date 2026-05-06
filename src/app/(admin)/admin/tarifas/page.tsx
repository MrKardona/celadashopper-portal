import { createClient } from '@supabase/supabase-js'
import TarifasForm from '@/components/admin/TarifasForm'
import TarifasRangosManager, { type TarifaRango } from '@/components/admin/TarifasRangosManager'

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Sistema con dos modelos: <strong>tarifas escalonadas</strong> (con condición, cantidad y rangos
          de valor) y <strong>tarifas legacy</strong> (precio simple por libra o por unidad).
          El cálculo prioriza siempre las escalonadas si existen para la categoría.
        </p>
      </div>

      {/* Tarifas escalonadas — modelo nuevo */}
      <TarifasRangosManager tarifas={tarifasRangos} />

      {/* Tarifas legacy — fallback para juguetes y otras categorías sin reglas escalonadas */}
      <div className="pt-6 border-t border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Tarifas legacy (fallback)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Aplica solo si la categoría no tiene tarifas escalonadas configuradas arriba.
            Útil para categorías simples como juguetes y otros productos.
          </p>
        </div>
        <TarifasForm tarifas={tarifasLegacy} />
      </div>
    </div>
  )
}
