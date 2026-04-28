import { createClient } from '@supabase/supabase-js'
import TarifasForm from '@/components/admin/TarifasForm'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdminTarifasPage() {
  const supabase = getSupabaseAdmin()
  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .order('nombre_display')

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Precios de referencia por categoría. El costo real se calcula como
          <span className="font-mono bg-gray-100 px-1 rounded mx-1">peso × tarifa</span>
          para ítems por libra, o precio fijo para electrónicos.
        </p>
      </div>

      <TarifasForm tarifas={tarifas ?? []} />
    </div>
  )
}
