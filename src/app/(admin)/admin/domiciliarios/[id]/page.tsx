export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Bike, Phone, Package, ArrowLeft, CheckCircle2, History, Camera, MapPin, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import OrdenarRutaPanel, { type ParadaRuta } from '@/components/admin/OrdenarRutaPanel'
import FotoThumb from '@/components/ui/FotoThumb'

const tw = 'rgba(255,255,255,'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface Props { params: Promise<{ id: string }> }

export default async function AdminDomiciliarioDetallePage({ params }: Props) {
  const { id } = await params
  const admin = getAdmin()

  const [perfilRes, paquetesRes, manualesRes, histPaqRes, histManRes] = await Promise.all([
    admin.from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono')
      .eq('id', id)
      .eq('rol', 'domiciliario')
      .single(),
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, orden_ruta')
      .eq('domiciliario_id', id)
      .in('estado', ['en_camino_cliente', 'en_bodega_local'])
      .is('paquete_origen_id', null)
      .order('orden_ruta', { ascending: true, nullsFirst: false }),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, telefono, notas, orden')
      .eq('domiciliario_id', id)
      .eq('estado', 'pendiente')
      .order('orden'),
    // Últimos paquetes entregados
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, cliente_id, direccion_entrega, barrio_entrega, updated_at')
      .eq('domiciliario_id', id)
      .eq('estado', 'entregado')
      .is('paquete_origen_id', null)
      .order('updated_at', { ascending: false })
      .limit(20),
    // Últimos domicilios manuales completados
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, foto_url, notas_entrega, completado_at')
      .eq('domiciliario_id', id)
      .eq('estado', 'completado')
      .order('completado_at', { ascending: false })
      .limit(20),
  ])

  if (!perfilRes.data) notFound()

  const perfil       = perfilRes.data
  const paquetes     = paquetesRes.data ?? []
  const manuales     = manualesRes.data ?? []
  const histPaquetes = histPaqRes.data ?? []
  const histManuales = histManRes.data ?? []
  const tel          = perfil.whatsapp ?? perfil.telefono

  // Fotos de entrega para historial
  const histIds = histPaquetes.map(p => p.id)
  const fotoEntregaMap: Record<string, string> = {}
  const fotoProductoMap: Record<string, string> = {}
  if (histIds.length > 0) {
    const { data: fotos } = await admin
      .from('fotos_paquetes')
      .select('paquete_id, url, descripcion')
      .in('paquete_id', histIds)
    for (const f of fotos ?? []) {
      const esEntrega = (f.descripcion ?? '').toLowerCase().includes('entrega')
      if (esEntrega) {
        if (!fotoEntregaMap[f.paquete_id]) fotoEntregaMap[f.paquete_id] = f.url
      } else {
        if (!fotoProductoMap[f.paquete_id]) fotoProductoMap[f.paquete_id] = f.url
      }
    }
  }

  // Nombres de clientes para historial
  const histClienteIds = [...new Set(histPaquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const histClienteNombres: Record<string, string> = {}
  if (histClienteIds.length > 0) {
    const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', histClienteIds)
    for (const p of pfs ?? []) histClienteNombres[p.id] = p.nombre_completo
  }

  // Unificar historial y ordenar desc
  type HistItem =
    | { kind: 'paquete'; ts: string; data: typeof histPaquetes[0] }
    | { kind: 'manual';  ts: string; data: typeof histManuales[0] }

  const histItems: HistItem[] = [
    ...histPaquetes.map(p => ({ kind: 'paquete' as const, ts: p.updated_at ?? '', data: p })),
    ...histManuales.map(m => ({ kind: 'manual'  as const, ts: m.completado_at ?? '', data: m })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15)

  function fechaCorta(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  // Direcciones de clientes para paquetes que no tienen la propia
  const sinDir = paquetes.filter(p => !p.direccion_entrega && p.cliente_id).map(p => p.cliente_id as string)
  const clienteDir: Record<string, { nombre: string; direccion: string | null; barrio: string | null }> = {}
  if (sinDir.length > 0) {
    const { data: pfs } = await admin.from('perfiles')
      .select('id, nombre_completo, direccion, barrio')
      .in('id', [...new Set(sinDir)])
    for (const p of pfs ?? []) clienteDir[p.id] = { nombre: p.nombre_completo, direccion: p.direccion, barrio: p.barrio }
  }
  // También para paquetes con dirección propia necesitamos el nombre del cliente
  const todosClienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (todosClienteIds.length > 0) {
    const idsNuevos = todosClienteIds.filter(cid => !clienteDir[cid])
    if (idsNuevos.length > 0) {
      const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', idsNuevos)
      for (const p of pfs ?? []) clienteNombres[p.id] = p.nombre_completo
    }
  }

  // ── Construir lista unificada ─────────────────────────────────────
  const paradasPaquetes: ParadaRuta[] = paquetes.map(p => {
    const cli = p.cliente_id ? (clienteDir[p.cliente_id] ?? null) : null
    const nombreCliente = p.cliente_id
      ? (clienteDir[p.cliente_id]?.nombre ?? clienteNombres[p.cliente_id] ?? null)
      : null
    const dir = p.direccion_entrega ?? (cli ? [cli.direccion, cli.barrio].filter(Boolean).join(', ') || null : null)
    return {
      tipo: 'paquete',
      id: p.id,
      label: nombreCliente ?? p.tracking_casilla ?? 'Sin tracking',
      descripcion: p.descripcion || '',
      direccion: dir,
      telefono: null,
      notas: null,
      ordenActual: p.orden_ruta ?? 9999,
    }
  })

  const paradasManuales: ParadaRuta[] = manuales.map(m => ({
    tipo: 'manual',
    id: m.id,
    label: m.nombre,
    descripcion: m.notas ?? '',
    direccion: m.direccion,
    telefono: m.telefono ?? null,
    notas: m.notas ?? null,
    ordenActual: m.orden ?? 9999,
  }))

  // Merge y ordenar: los que tienen orden_ruta/orden definido van primero
  const todasParadas = [...paradasPaquetes, ...paradasManuales]
    .sort((a, b) => a.ordenActual - b.ordenActual)

  const total = todasParadas.length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs mt-1 transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: `${tw}0.4)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Domiciliarios
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              {perfil.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Bike className="h-5 w-5 flex-shrink-0" style={{ color: '#818cf8' }} />
                <span className="truncate">{perfil.nombre_completo}</span>
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {tel && (
                  <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#25D366' }}>
                    <Phone className="h-3 w-3" />{tel}
                  </a>
                )}
                <span className="text-xs" style={{ color: `${tw}0.35)` }}>
                  {total === 0
                    ? 'Sin entregas pendientes'
                    : `${total} entrega${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {total === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas pendientes</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            No hay paquetes ni domicilios manuales asignados a este domiciliario
          </p>
        </div>
      ) : (
        <div className="glass-card p-5" style={{ borderColor: 'rgba(129,140,248,0.15)' }}>
          <OrdenarRutaPanel domiciliarioId={id} paradas={todasParadas} />
        </div>
      )}

      {/* Historial de entregas recientes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>
            Historial reciente
            {histItems.length > 0 && (
              <span className="ml-2 text-[10px] font-normal" style={{ color: `${tw}0.25)` }}>
                ({histItems.length} entrega{histItems.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
          <Link href={`/admin/domiciliarios/${id}/historial`}
            className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: '#34d399' }}>
            <History className="h-3 w-3" /> Ver todo
          </Link>
        </div>

        {histItems.length === 0 ? (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-10 text-white" />
            <p className="text-xs" style={{ color: `${tw}0.3)` }}>Sin entregas registradas aún</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {histItems.map(item => {
              if (item.kind === 'manual') {
                const m = item.data
                return (
                  <div key={`hm-${m.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.1)' }}>
                    <div className="flex-shrink-0">
                      {m.foto_url ? (
                        <FotoThumb url={m.foto_url} alt={m.nombre} width={36} height={36} radius="0.5rem" />
                      ) : (
                        <div className="rounded-lg flex items-center justify-center"
                          style={{ width: 36, height: 36, background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)' }}>
                          <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{m.nombre}</p>
                      {m.direccion && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: `${tw}0.2)` }} />
                          <p className="text-[10px] truncate" style={{ color: `${tw}0.4)` }}>{m.direccion}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] flex-shrink-0" style={{ color: `${tw}0.3)` }}>
                      {fechaCorta(m.completado_at ?? '')}
                    </p>
                  </div>
                )
              }

              const p = item.data
              const fotoProducto = fotoProductoMap[p.id] ?? null
              const fotoEntrega  = fotoEntregaMap[p.id] ?? null
              const clienteNombre = p.cliente_id ? (histClienteNombres[p.cliente_id] ?? null) : null
              return (
                <Link key={`hp-${p.id}`} href={`/admin/paquetes/${p.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:brightness-125"
                  style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.1)' }}>
                  <div className="flex-shrink-0">
                    <FotoThumb
                      url={fotoEntrega ?? fotoProducto}
                      alt={p.descripcion ?? p.tracking_casilla ?? ''}
                      width={36} height={36} radius="0.5rem"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold truncate" style={{ color: '#F5B800' }}>
                      {p.tracking_origen ?? p.tracking_casilla}
                    </p>
                    {(clienteNombre || p.descripcion) && (
                      <p className="text-[10px] truncate" style={{ color: `${tw}0.4)` }}>
                        {clienteNombre ?? p.descripcion}
                      </p>
                    )}
                    {(p.direccion_entrega || p.barrio_entrega) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 flex-shrink-0" style={{ color: `${tw}0.2)` }} />
                        <p className="text-[10px] truncate" style={{ color: `${tw}0.35)` }}>
                          {[p.direccion_entrega, p.barrio_entrega].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {fotoEntrega ? (
                      <Camera className="h-3 w-3" style={{ color: '#34d399' }} />
                    ) : (
                      <Camera className="h-3 w-3" style={{ color: `${tw}0.15)` }} />
                    )}
                    <p className="text-[10px]" style={{ color: `${tw}0.3)` }}>
                      {fechaCorta(p.updated_at ?? '')}
                    </p>
                    <ChevronRight className="h-3 w-3" style={{ color: `${tw}0.15)` }} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <Link href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: `${tw}0.35)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/admin/domiciliarios/${id}/historial`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
            <History className="h-3.5 w-3.5" /> Historial de entregas
          </Link>
          <Link href={`/admin/listos-entrega?domiciliario=${id}`}
            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            style={{ color: `${tw}0.35)` }}>
            <Package className="h-3.5 w-3.5" /> Listos para entrega
          </Link>
        </div>
      </div>
    </div>
  )
}
