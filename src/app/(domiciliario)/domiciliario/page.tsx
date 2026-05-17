export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CheckCircle2, Package } from 'lucide-react'
import RutaDomiciliarioPanel, { type Parada } from '@/components/domiciliario/RutaDomiciliarioPanel'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}
const tw = 'rgba(255,255,255,'

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function DomiciliarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'domiciliario') redirect('/dashboard')

  const [paquetesRes, manualesRes] = await Promise.all([
    admin
      .from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, costo_servicio, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega, estado, orden_ruta, fecha_asignacion_domiciliario')
      .eq('domiciliario_id', user.id)
      .in('estado', ['en_camino_cliente', 'en_bodega_local'])
      .is('paquete_origen_id', null),
    admin
      .from('domicilios_manuales')
      .select('id, nombre, direccion, telefono, notas, orden, created_at')
      .eq('domiciliario_id', user.id)
      .eq('estado', 'pendiente'),
  ])

  const paquetes = paquetesRes.data ?? []
  const manuales = manualesRes.data ?? []

  // Perfiles de clientes
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, {
    nombre_completo: string
    whatsapp: string | null
    telefono: string | null
    direccion: string | null
    barrio: string | null
    referencia: string | null
  }> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin
      .from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, direccion, barrio, referencia')
      .in('id', clienteIds)
    for (const p of pfs ?? []) perfilesMap[p.id] = p
  }

  // Unificar y ordenar por ruta
  type RawItem =
    | { kind: 'paquete'; orden: number; data: typeof paquetes[0] }
    | { kind: 'manual';  orden: number; data: typeof manuales[0] }

  const rawItems: RawItem[] = [
    ...paquetes.map(p => ({ kind: 'paquete' as const, orden: p.orden_ruta ?? 9999, data: p })),
    ...manuales.map(m => ({ kind: 'manual'  as const, orden: m.orden  ?? 9999, data: m })),
  ].sort((a, b) => a.orden - b.orden)

  const total = rawItems.length

  // Construir props tipados para el panel
  const paradas: Parada[] = rawItems.map((item, idx) => {
    const num = idx + 1
    if (item.kind === 'manual') {
      const m = item.data
      return {
        kind: 'manual',
        num,
        id: m.id,
        nombre: m.nombre,
        direccion: m.direccion,
        telefono: m.telefono ?? null,
        notas: m.notas ?? null,
      }
    }
    const p   = item.data
    const cli = p.cliente_id ? perfilesMap[p.cliente_id] : null
    return {
      kind:          'paquete',
      num,
      id:            p.id,
      tracking:      p.tracking_origen ?? p.tracking_casilla ?? null,
      descripcion:   p.descripcion ?? null,
      bodega:        p.bodega_destino ?? null,
      clienteNombre: cli?.nombre_completo ?? null,
      tel:           cli?.whatsapp ?? cli?.telefono ?? null,
      direccion:     p.direccion_entrega  ?? cli?.direccion  ?? null,
      barrio:        p.barrio_entrega     ?? cli?.barrio     ?? null,
      referencia:    p.referencia_entrega ?? cli?.referencia ?? null,
      pesoLibras:    p.peso_libras   ? Number(p.peso_libras)   : null,
      costoServicio: p.costo_servicio ? Number(p.costo_servicio) : null,
    }
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" style={{ color: '#34d399' }} />
            Mis entregas
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {total === 0
              ? 'No tienes entregas asignadas por ahora'
              : `${total} entrega${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas asignadas</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            El administrador te asignará entregas cuando estén listas
          </p>
        </div>
      ) : (
        <RutaDomiciliarioPanel paradas={paradas} />
      )}

      <p className="text-center text-xs" style={{ color: `${tw}0.18)` }}>
        Los paquetes entregados desaparecen automáticamente de esta lista
      </p>
    </div>
  )
}
