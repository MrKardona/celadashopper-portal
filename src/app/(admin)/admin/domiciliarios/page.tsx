export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Bike, Package, Phone, Eye } from 'lucide-react'
import Link from 'next/link'
import NuevoDomiciliarioModal from '@/components/admin/NuevoDomiciliarioModal'
import NuevoDomicilioManualModal from '@/components/admin/NuevoDomicilioManualModal'
import DomiciliosManualesLista from '@/components/admin/DomiciliosManualesLista'

const tw = 'rgba(255,255,255,'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )
}

export default async function DomiciliariosPage() {
  const admin = getSupabaseAdmin()

  const { data: domiciliarios } = await admin
    .from('perfiles')
    .select('id, nombre_completo, whatsapp, telefono, email')
    .eq('rol', 'domiciliario')
    .eq('activo', true)
    .order('nombre_completo')

  const lista = domiciliarios ?? []

  // Paquetes en camino + domicilios manuales por domiciliario
  const domIds = lista.map(d => d.id)
  const paquetesMap: Record<string, { enCamino: number; entregadosHoy: number }> = {}
  const manualesMap: Record<string, { id: string; nombre: string; direccion: string; notas: string | null }[]> = {}

  if (domIds.length > 0) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

    const [enCaminoRes, entregadosRes, manualesPendientesRes, manualesEntregadosRes] = await Promise.all([
      admin.from('paquetes')
        .select('domiciliario_id')
        .in('domiciliario_id', domIds)
        .in('estado', ['en_camino_cliente', 'en_bodega_local']),
      admin.from('paquetes')
        .select('domiciliario_id')
        .in('domiciliario_id', domIds)
        .eq('estado', 'entregado')
        .gte('updated_at', hoy.toISOString()),
      admin.from('domicilios_manuales')
        .select('id, domiciliario_id, nombre, direccion, notas')
        .in('domiciliario_id', domIds)
        .eq('estado', 'pendiente')
        .order('orden'),
      admin.from('domicilios_manuales')
        .select('domiciliario_id')
        .in('domiciliario_id', domIds)
        .eq('estado', 'completado')
        .gte('updated_at', hoy.toISOString()),
    ])

    for (const p of enCaminoRes.data ?? []) {
      if (!p.domiciliario_id) continue
      if (!paquetesMap[p.domiciliario_id]) paquetesMap[p.domiciliario_id] = { enCamino: 0, entregadosHoy: 0 }
      paquetesMap[p.domiciliario_id].enCamino++
    }
    for (const p of entregadosRes.data ?? []) {
      if (!p.domiciliario_id) continue
      if (!paquetesMap[p.domiciliario_id]) paquetesMap[p.domiciliario_id] = { enCamino: 0, entregadosHoy: 0 }
      paquetesMap[p.domiciliario_id].entregadosHoy++
    }
    for (const m of manualesPendientesRes.data ?? []) {
      if (!m.domiciliario_id) continue
      if (!manualesMap[m.domiciliario_id]) manualesMap[m.domiciliario_id] = []
      manualesMap[m.domiciliario_id].push(m)
    }
    // Sumar domicilios manuales completados hoy al contador
    for (const m of manualesEntregadosRes.data ?? []) {
      if (!m.domiciliario_id) continue
      if (!paquetesMap[m.domiciliario_id]) paquetesMap[m.domiciliario_id] = { enCamino: 0, entregadosHoy: 0 }
      paquetesMap[m.domiciliario_id].entregadosHoy++
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bike className="h-6 w-6" style={{ color: '#818cf8' }} />
            Domiciliarios
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {lista.length} domiciliario{lista.length !== 1 ? 's' : ''} activo{lista.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NuevoDomiciliarioModal />
      </div>

      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bike className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.4)` }}>No hay domiciliarios registrados</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            Usa el botón &quot;Nuevo domiciliario&quot; para asignar el rol a un usuario registrado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(d => {
            const stats = paquetesMap[d.id] ?? { enCamino: 0, entregadosHoy: 0 }
            const totalEnCamino = stats.enCamino + (manualesMap[d.id]?.length ?? 0)
            const tel = d.whatsapp ?? d.telefono

            return (
              <div key={d.id} className="glass-card p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    {d.nombre_completo.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{d.nombre_completo}</p>
                    {tel && (
                      <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#25D366' }}>
                        <Phone className="h-3 w-3" />{tel}
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl px-3 py-2.5 text-center"
                    style={{ background: totalEnCamino > 0 ? 'rgba(99,102,241,0.1)' : `${tw}0.04)`, border: `1px solid ${totalEnCamino > 0 ? 'rgba(99,102,241,0.2)' : `${tw}0.07)`}` }}>
                    <p className="text-2xl font-bold" style={{ color: totalEnCamino > 0 ? '#818cf8' : `${tw}0.3)` }}>
                      {totalEnCamino}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: `${tw}0.35)` }}>En camino</p>
                  </div>
                  <div className="rounded-xl px-3 py-2.5 text-center"
                    style={{ background: stats.entregadosHoy > 0 ? 'rgba(52,211,153,0.08)' : `${tw}0.04)`, border: `1px solid ${stats.entregadosHoy > 0 ? 'rgba(52,211,153,0.2)' : `${tw}0.07)`}` }}>
                    <p className="text-2xl font-bold" style={{ color: stats.entregadosHoy > 0 ? '#34d399' : `${tw}0.3)` }}>
                      {stats.entregadosHoy}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: `${tw}0.35)` }}>Entregados hoy</p>
                  </div>
                </div>

                {/* Domicilios manuales pendientes */}
                {(manualesMap[d.id] ?? []).length > 0 && (
                  <DomiciliosManualesLista manuales={manualesMap[d.id]} />
                )}

                {/* Acciones */}
                <div className="space-y-2">
                  <Link
                    href={`/admin/domiciliarios/${d.id}`}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all w-full"
                    style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8' }}>
                    <Eye className="h-3.5 w-3.5" />
                    Ver entregas asignadas
                  </Link>
                  <Link
                    href={`/admin/listos-entrega?domiciliario=${d.id}`}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all w-full"
                    style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}>
                    <Package className="h-3.5 w-3.5" />
                    Listos para entrega
                  </Link>
                  <NuevoDomicilioManualModal
                    domiciliarioId={d.id}
                    domiciliarioNombre={d.nombre_completo}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
