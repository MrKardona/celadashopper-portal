export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileText, Package, Camera, MapPin, StickyNote } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const tw = 'rgba(255,255,255,'
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function fechaBogota(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}
function soloDiaBogota(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

interface Props { params: Promise<{ id: string }> }

export default async function AdminHistorialDomiciliarioPage({ params }: Props) {
  const { id } = await params
  const admin = getAdmin()

  const [perfilRes, paquetesRes, manualesRes] = await Promise.all([
    admin.from('perfiles')
      .select('id, nombre_completo')
      .eq('id', id)
      .eq('rol', 'domiciliario')
      .single(),
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, updated_at')
      .eq('domiciliario_id', id)
      .eq('estado', 'entregado')
      .is('paquete_origen_id', null)
      .order('updated_at', { ascending: false })
      .limit(120),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, telefono, notas, notas_entrega, foto_url, updated_at')
      .eq('domiciliario_id', id)
      .eq('estado', 'completado')
      .order('updated_at', { ascending: false })
      .limit(120),
  ])

  if (!perfilRes.data) notFound()
  const perfil   = perfilRes.data
  const paquetes = paquetesRes.data ?? []
  const manuales = manualesRes.data ?? []

  // Fotos de paquetes (de fotos_paquetes)
  const paqIds = paquetes.map(p => p.id)
  const fotosMap: Record<string, string> = {}
  if (paqIds.length > 0) {
    const { data: fotos } = await admin
      .from('fotos_paquetes')
      .select('paquete_id, url, tipo')
      .in('paquete_id', paqIds)
      .eq('tipo', 'entrega')
    for (const f of fotos ?? []) fotosMap[f.paquete_id] = f.url
  }

  // Nombres de clientes
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    for (const p of pfs ?? []) clienteNombres[p.id] = p.nombre_completo
  }

  // Unificar y ordenar por fecha desc
  type Item =
    | { kind: 'paquete'; ts: string; data: typeof paquetes[0] }
    | { kind: 'manual';  ts: string; data: typeof manuales[0] }

  const items: Item[] = [
    ...paquetes.map(p => ({ kind: 'paquete' as const, ts: p.updated_at ?? '', data: p })),
    ...manuales.map(m => ({ kind: 'manual'  as const, ts: m.updated_at ?? '', data: m })),
  ].sort((a, b) => b.ts.localeCompare(a.ts))

  const total = items.length

  // Agrupar por día (hora Bogotá)
  const grupos: { dia: string; items: typeof items }[] = []
  for (const item of items) {
    const dia = soloDiaBogota(item.ts)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.dia === dia) ultimo.items.push(item)
    else grupos.push({ dia, items: [item] })
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href={`/admin/domiciliarios/${id}`}
          className="flex items-center gap-1.5 text-xs mt-1 transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: `${tw}0.4)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Ruta
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: '#34d399' }} />
            Historial de entregas
          </h1>
          <p className="text-sm mt-0.5" style={{ color: `${tw}0.4)` }}>
            {perfil.nombre_completo} · {total === 0 ? 'Sin entregas registradas' : `${total} entrega${total !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas aún</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            Las entregas completadas aparecerán aquí con sus comprobantes
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ dia, items: grupo }) => (
            <div key={dia} className="space-y-3">

              {/* Separador de día */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: `${tw}0.07)` }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest px-2"
                  style={{ color: `${tw}0.3)` }}>
                  {dia}
                </span>
                <div className="h-px flex-1" style={{ background: `${tw}0.07)` }} />
              </div>

              {/* Cards del día */}
              {grupo.map(item => {
                /* ── Domicilio manual ── */
                if (item.kind === 'manual') {
                  const m = item.data
                  return (
                    <div key={`manual-${m.id}`} className="glass-card p-4 space-y-3"
                      style={{ borderColor: 'rgba(129,140,248,0.18)' }}>

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(129,140,248,0.12)' }}>
                            <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{m.nombre}</p>
                            <p className="text-[11px]" style={{ color: '#818cf8' }}>Domicilio manual</p>
                          </div>
                        </div>
                        <p className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: `${tw}0.3)` }}>
                          {fechaBogota(m.updated_at ?? '')}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        {/* Foto comprobante */}
                        {m.foto_url ? (
                          <a href={m.foto_url} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                            style={{ width: 72, height: 72, border: '1px solid rgba(129,140,248,0.2)' }}>
                            <Image src={m.foto_url} alt="Comprobante" width={72} height={72}
                              className="object-cover w-full h-full" />
                          </a>
                        ) : (
                          <div className="flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-1"
                            style={{ width: 72, height: 72, background: `${tw}0.03)`, border: `1px dashed ${tw}0.1)` }}>
                            <Camera className="h-4 w-4" style={{ color: `${tw}0.18)` }} />
                            <p className="text-[9px]" style={{ color: `${tw}0.2)` }}>Sin foto</p>
                          </div>
                        )}

                        <div className="flex-1 min-w-0 space-y-1.5">
                          {m.direccion && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.25)` }} />
                              <p className="text-xs" style={{ color: `${tw}0.5)` }}>{m.direccion}</p>
                            </div>
                          )}
                          {m.notas_entrega && (
                            <div className="flex items-start gap-1.5">
                              <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.2)` }} />
                              <p className="text-xs italic" style={{ color: `${tw}0.4)` }}>{m.notas_entrega}</p>
                            </div>
                          )}
                          {m.notas && !m.notas_entrega && (
                            <p className="text-[11px]" style={{ color: `${tw}0.3)` }}>{m.notas}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }

                /* ── Paquete del sistema ── */
                const p = item.data
                const fotoUrl = fotosMap[p.id] ?? null
                const clienteNombre = p.cliente_id ? (clienteNombres[p.cliente_id] ?? null) : null

                return (
                  <div key={`paquete-${p.id}`} className="glass-card p-4 space-y-3"
                    style={{ borderColor: 'rgba(52,211,153,0.15)' }}>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(52,211,153,0.1)' }}>
                          <Package className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold truncate" style={{ color: '#F5B800' }}>
                            {p.tracking_origen ?? p.tracking_casilla}
                          </p>
                          <p className="text-[11px]" style={{ color: '#34d399' }}>
                            {BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: `${tw}0.3)` }}>
                        {fechaBogota(p.updated_at ?? '')}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      {/* Foto comprobante */}
                      {fotoUrl ? (
                        <a href={fotoUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                          style={{ width: 72, height: 72, border: '1px solid rgba(52,211,153,0.2)' }}>
                          <Image src={fotoUrl} alt="Comprobante" width={72} height={72}
                            className="object-cover w-full h-full" />
                        </a>
                      ) : (
                        <div className="flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-1"
                          style={{ width: 72, height: 72, background: `${tw}0.03)`, border: `1px dashed ${tw}0.1)` }}>
                          <Camera className="h-4 w-4" style={{ color: `${tw}0.18)` }} />
                          <p className="text-[9px]" style={{ color: `${tw}0.2)` }}>Sin foto</p>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        {p.descripcion && (
                          <p className="text-xs font-medium text-white">{p.descripcion}</p>
                        )}
                        {clienteNombre && (
                          <p className="text-[11px]" style={{ color: `${tw}0.4)` }}>{clienteNombre}</p>
                        )}
                        {(p.direccion_entrega || p.barrio_entrega) && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.25)` }} />
                            <p className="text-[11px]" style={{ color: `${tw}0.45)` }}>
                              {[p.direccion_entrega, p.barrio_entrega].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <Link href={`/admin/domiciliarios/${id}`}
        className="flex items-center justify-center gap-1.5 text-xs pt-2 transition-opacity hover:opacity-70"
        style={{ color: `${tw}0.3)` }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a la ruta
      </Link>
    </div>
  )
}
