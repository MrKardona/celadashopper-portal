export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Bike, Package, Phone, Eye, History, TableProperties } from 'lucide-react'
import Link from 'next/link'
import NuevoDomiciliarioModal from '@/components/admin/NuevoDomiciliarioModal'
import NuevoDomicilioManualModal from '@/components/admin/NuevoDomicilioManualModal'
import DomiciliosManualesLista from '@/components/admin/DomiciliosManualesLista'
import EliminarDomiciliarioButton from '@/components/admin/EliminarDomiciliarioButton'
import InformeDomiciliariosButton from '@/components/admin/InformeDomiciliariosButton'

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

  const domIds = lista.map(d => d.id)
  const paquetesMap: Record<string, { enCamino: number; entregadosHoy: number }> = {}
  const manualesMap: Record<string, { id: string; nombre: string; direccion: string; notas: string | null }[]> = {}

  if (domIds.length > 0) {
    const fechaBogota = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const hoy = new Date(`${fechaBogota}T05:00:00.000Z`)

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
        .gte('completado_at', hoy.toISOString()),
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
    for (const m of manualesEntregadosRes.data ?? []) {
      if (!m.domiciliario_id) continue
      if (!paquetesMap[m.domiciliario_id]) paquetesMap[m.domiciliario_id] = { enCamino: 0, entregadosHoy: 0 }
      paquetesMap[m.domiciliario_id].entregadosHoy++
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────── */}
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
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/domiciliarios/planilla"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
          >
            <TableProperties className="h-3.5 w-3.5" />
            Planilla
          </Link>
          <InformeDomiciliariosButton />
          <NuevoDomiciliarioModal />
        </div>
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
            const stats       = paquetesMap[d.id] ?? { enCamino: 0, entregadosHoy: 0 }
            const manuales    = manualesMap[d.id] ?? []
            const totalEnCamino = stats.enCamino + manuales.length
            const tel         = d.whatsapp ?? d.telefono
            const activo      = totalEnCamino > 0

            return (
              <div
                key={d.id}
                className="glass-card overflow-hidden flex flex-col"
                style={{
                  borderTop: `2px solid ${activo ? 'rgba(129,140,248,0.4)' : `${tw}0.07)`}`,
                }}
              >
                {/* ── Cabecera del domiciliario ────────────────────── */}
                <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  >
                    {d.nombre_completo.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate leading-tight">{d.nombre_completo}</p>
                    {tel && (
                      <a
                        href={`https://wa.me/${tel.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs hover:underline mt-0.5"
                        style={{ color: '#25D366' }}
                      >
                        <Phone className="h-3 w-3" />{tel}
                      </a>
                    )}
                  </div>
                  {/* Eliminar — discreto, top-right */}
                  <div className="flex-shrink-0 mt-0.5">
                    <EliminarDomiciliarioButton id={d.id} nombre={d.nombre_completo} compact />
                  </div>
                </div>

                {/* ── Stats ───────────────────────────────────────── */}
                <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                  <div
                    className="rounded-xl px-3 py-2.5 text-center"
                    style={{
                      background: totalEnCamino > 0 ? 'rgba(99,102,241,0.1)' : `${tw}0.03)`,
                      border: `1px solid ${totalEnCamino > 0 ? 'rgba(99,102,241,0.22)' : `${tw}0.07)`}`,
                    }}
                  >
                    <p className="text-2xl font-bold leading-none"
                      style={{ color: totalEnCamino > 0 ? '#818cf8' : `${tw}0.25)` }}>
                      {totalEnCamino}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>En camino</p>
                  </div>
                  <div
                    className="rounded-xl px-3 py-2.5 text-center"
                    style={{
                      background: stats.entregadosHoy > 0 ? 'rgba(52,211,153,0.08)' : `${tw}0.03)`,
                      border: `1px solid ${stats.entregadosHoy > 0 ? 'rgba(52,211,153,0.22)' : `${tw}0.07)`}`,
                    }}
                  >
                    <p className="text-2xl font-bold leading-none"
                      style={{ color: stats.entregadosHoy > 0 ? '#34d399' : `${tw}0.25)` }}>
                      {stats.entregadosHoy}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Entregados hoy</p>
                  </div>
                </div>

                {/* ── Domicilios manuales pendientes ──────────────── */}
                {manuales.length > 0 && (
                  <div className="px-4 pb-3">
                    <DomiciliosManualesLista manuales={manuales} />
                  </div>
                )}

                {/* ── Separador ───────────────────────────────────── */}
                <div className="mx-4" style={{ height: '1px', background: `${tw}0.06)` }} />

                {/* ── Acciones de navegación (3 columnas) ─────────── */}
                <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-2">
                  <Link
                    href={`/admin/domiciliarios/${d.id}`}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                    style={{
                      background: 'rgba(129,140,248,0.07)',
                      border: '1px solid rgba(129,140,248,0.18)',
                      color: '#818cf8',
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Ver entregas
                  </Link>
                  <Link
                    href={`/admin/listos-entrega?domiciliario=${d.id}`}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                    style={{
                      background: `${tw}0.03)`,
                      border: `1px solid ${tw}0.09)`,
                      color: `${tw}0.5)`,
                    }}
                  >
                    <Package className="h-4 w-4" />
                    Listos
                  </Link>
                  <Link
                    href={`/admin/domiciliarios/${d.id}/historial`}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium transition-all"
                    style={{
                      background: 'rgba(52,211,153,0.06)',
                      border: '1px solid rgba(52,211,153,0.16)',
                      color: '#34d399',
                    }}
                  >
                    <History className="h-4 w-4" />
                    Historial
                  </Link>
                </div>

                {/* ── Agregar domicilio manual ─────────────────────── */}
                <div className="px-4 pb-4">
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
