export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Box } from 'lucide-react'
import NuevaCajaButton from '@/components/admin/NuevaCajaButton'
import SugerirArmadoButton from '@/components/admin/SugerirArmadoButton'
import CajasPageClient from '@/components/admin/CajasPageClient'

const tw = 'rgba(255,255,255,'

export default async function CajasPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const { data: cajas } = await supabase
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, tipo, peso_estimado, peso_real, estado, estado_usaco, usaco_sync_at, created_at, fecha_despacho, fecha_recepcion_colombia')
    .order('created_at', { ascending: false })
    .limit(300)

  const lista = cajas ?? []

  // Contar paquetes por caja + estado USACO por caja
  const cajaIds = lista.map(c => c.id)
  const conteoMap: Record<string, number> = {}
  const estadoUsacoMap: Record<string, string> = {}
  if (cajaIds.length > 0) {
    const { data: paquetes } = await supabase
      .from('paquetes')
      .select('caja_id, estado_usaco')
      .in('caja_id', cajaIds)
    for (const p of paquetes ?? []) {
      if (p.caja_id) conteoMap[p.caja_id] = (conteoMap[p.caja_id] ?? 0) + 1
      if (p.caja_id && p.estado_usaco && !estadoUsacoMap[p.caja_id]) {
        estadoUsacoMap[p.caja_id] = p.estado_usaco
      }
    }
  }

  const activas   = lista.filter(c => ['abierta', 'cerrada', 'despachada'].includes(c.estado))
  const historial = lista.filter(c => c.estado === 'recibida_colombia')

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="h-6 w-6" style={{ color: '#F5B800' }} />
            Cajas para envío a Colombia
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {activas.length} activa{activas.length !== 1 ? 's' : ''} · {historial.length} recibida{historial.length !== 1 ? 's' : ''} en Colombia
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
<SugerirArmadoButton />
          <NuevaCajaButton />
        </div>
      </div>

      {/* Grid interactivo + panel deslizante */}
      <CajasPageClient cajas={lista} conteoMap={conteoMap} estadoUsacoMap={estadoUsacoMap} />
    </div>
  )
}
