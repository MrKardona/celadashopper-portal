export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { MapPin, User, Phone, ExternalLink, AlertTriangle, Package, Bike } from 'lucide-react'
import Link from 'next/link'
import EntregarPaqueteButton from '@/components/admin/EntregarPaqueteButton'
import FacturaBadge from '@/components/admin/FacturaBadge'
import AsignarDomiciliarioButton from '@/components/admin/AsignarDomiciliarioButton'
import LimitSelector from '@/components/ui/LimitSelector'
import FotoThumb from '@/components/ui/FotoThumb'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface Props { searchParams: Promise<{ ciudad?: string; domiciliario?: string; limite?: string }> }

export default async function ListosEntregaPage({ searchParams }: Props) {
  const params = await searchParams
  const { ciudad, domiciliario: filtroDomiciliario } = params
  const limite = [10, 50, 100].includes(Number(params.limite)) ? Number(params.limite) : 50

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q = supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, costo_servicio, estado, factura_id, factura_pagada, bodega_destino, fecha_llegada_colombia, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega, domiciliario_id')
    .in('estado', ['en_bodega_local', 'en_camino_cliente'])
    .eq('visible_cliente', true)
    .is('paquete_origen_id', null)
    .order('fecha_llegada_colombia', { ascending: true })

  if (ciudad) q = q.eq('bodega_destino', ciudad)
  if (filtroDomiciliario) q = q.eq('domiciliario_id', filtroDomiciliario)
  const { data: paquetes } = await q.limit(limite)
  const lista = paquetes ?? []

  // Domiciliarios activos
  const { data: domiciliariosData } = await supabase
    .from('perfiles')
    .select('id, nombre_completo')
    .eq('rol', 'domiciliario')
    .eq('activo', true)
    .order('nombre_completo')
  const domiciliarios = domiciliariosData ?? []
  const domMap: Record<string, string> = {}
  for (const d of domiciliarios) domMap[d.id] = d.nombre_completo

  // Perfiles de clientes
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, {
    nombre_completo: string; email: string | null; whatsapp: string | null
    telefono: string | null; direccion: string | null; barrio: string | null
    referencia: string | null; numero_casilla: string | null
  }> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles').select('id, nombre_completo, email, whatsapp, telefono, direccion, barrio, referencia, numero_casilla').in('id', clienteIds)
    for (const p of perfiles ?? []) perfilesMap[p.id] = p
  }

  // Clientes con múltiples paquetes en la misma bodega
  const paquetesPorCliente: Record<string, typeof lista> = {}
  for (const p of lista) {
    if (!p.cliente_id) continue
    const key = `${p.cliente_id}::${p.bodega_destino ?? ''}`
    if (!paquetesPorCliente[key]) paquetesPorCliente[key] = []
    paquetesPorCliente[key].push(p)
  }
  const gruposConsolidar = Object.values(paquetesPorCliente).filter(g => g.length >= 2)
  const clientesConMultiples = new Set(gruposConsolidar.flatMap(g => g.map(p => p.cliente_id).filter(Boolean)))

  // Paquetes pendientes por llegar
  const ESTADOS_PENDIENTES = ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio', 'en_transito']
  const ESTADO_LABELS_PENDIENTE: Record<string, string> = {
    reportado: 'Reportado', recibido_usa: 'En USA', en_consolidacion: 'Consolidando',
    listo_envio: 'Listo envío', en_transito: 'En tránsito',
  }
  interface PaqPendiente { id: string; descripcion: string | null; tracking_casilla: string | null; tracking_origen: string | null; estado: string }
  const pendientesPorCliente: Record<string, PaqPendiente[]> = {}
  if (clienteIds.length > 0) {
    const { data: pendientes } = await supabase
      .from('paquetes')
      .select('id, cliente_id, descripcion, tracking_casilla, tracking_origen, estado, bodega_destino')
      .in('cliente_id', clienteIds)
      .in('estado', ESTADOS_PENDIENTES)
      .eq('visible_cliente', true)
      .order('created_at', { ascending: true })
    for (const p of pendientes ?? []) {
      if (!p.cliente_id) continue
      if (!pendientesPorCliente[p.cliente_id]) pendientesPorCliente[p.cliente_id] = []
      pendientesPorCliente[p.cliente_id].push(p)
    }
  }

  // Primera foto por paquete
  const fotosMap: Record<string, string> = {}
  if (lista.length > 0) {
    const { data: fotos } = await supabase
      .from('fotos_paquetes')
      .select('paquete_id, url')
      .in('paquete_id', lista.map(p => p.id))
      .order('created_at', { ascending: true })
    for (const f of fotos ?? []) {
      if (!fotosMap[f.paquete_id]) fotosMap[f.paquete_id] = f.url
    }
  }

  const ciudades = [...new Set(lista.map(p => p.bodega_destino).filter(Boolean))]

  // Contadores por estado
  const nBodega  = lista.filter(p => p.estado === 'en_bodega_local').length
  const nCamino  = lista.filter(p => p.estado === 'en_camino_cliente').length

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Listos para entrega</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm" style={{ color: `${tw}0.45)` }}>
              {lista.length} paquete{lista.length !== 1 ? 's' : ''}
            </p>
            {nBodega > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                {nBodega} en bodega
              </span>
            )}
            {nCamino > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Bike className="h-3 w-3 inline mr-1" />{nCamino} en camino
              </span>
            )}
          </div>
        </div>
        <LimitSelector actual={limite} />
      </div>

      {/* ── Filtro ciudades ────────────────────────────────────────────── */}
      {ciudades.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[{ val: '', label: 'Todas' }, ...ciudades.map(c => ({ val: c!, label: BODEGA_LABELS[c!] ?? c! }))].map(({ val, label }) => (
            <a key={val} href={val ? `/admin/listos-entrega?ciudad=${val}` : '/admin/listos-entrega'}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={(ciudad ?? '') === val
                ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}>
              {label}
            </a>
          ))}
        </div>
      )}

      {/* ── Alerta consolidar ──────────────────────────────────────────── */}
      {gruposConsolidar.length > 0 && (
        <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(52,211,153,0.22)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'rgba(52,211,153,0.05)', borderBottom: '1px solid rgba(52,211,153,0.1)' }}>
            <span style={{ color: '#34d399' }}>📦</span>
            <p className="text-sm font-semibold" style={{ color: '#34d399' }}>
              {gruposConsolidar.length === 1 ? '1 cliente' : `${gruposConsolidar.length} clientes`} con varios paquetes — coordinar entrega conjunta
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: `${tw}0.05)` }}>
            {gruposConsolidar.map((grupo, i) => {
              const cli = grupo[0].cliente_id ? perfilesMap[grupo[0].cliente_id] : null
              return (
                <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{cli?.nombre_completo ?? 'Sin asignar'}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                    {grupo.length} paquetes · {BODEGA_LABELS[grupo[0].bodega_destino] ?? grupo[0].bodega_destino}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>No hay paquetes pendientes de entrega</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Cuando recibas cajas en Colombia, los paquetes aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {lista.map(p => {
            const cli        = p.cliente_id ? perfilesMap[p.cliente_id] : null
            const direccion  = p.direccion_entrega ?? cli?.direccion ?? null
            const barrio     = p.barrio_entrega ?? cli?.barrio ?? null
            const referencia = p.referencia_entrega ?? cli?.referencia ?? null
            const tel        = cli?.whatsapp ?? cli?.telefono ?? null
            const paqPend    = p.cliente_id ? (pendientesPorCliente[p.cliente_id] ?? []) : []
            const nPend      = paqPend.length
            const enCamino   = p.estado === 'en_camino_cliente'

            const dias = p.fecha_llegada_colombia
              ? Math.floor((Date.now() - new Date(p.fecha_llegada_colombia).getTime()) / 86_400_000)
              : null

            // Accent color
            const accentGrad = nPend > 0
              ? 'linear-gradient(to right,#ef4444,#f87171)'
              : enCamino
                ? 'linear-gradient(to right,#6366f1,#818cf8)'
                : 'linear-gradient(to right,#10b981,#34d399)'

            return (
              <div key={p.id} className="glass-card overflow-hidden flex flex-col"
                style={nPend > 0 ? { borderColor: 'rgba(239,68,68,0.3)' } : undefined}>

                {/* Barra de acento superior */}
                <div className="h-[3px] w-full flex-shrink-0" style={{ background: accentGrad }} />

                {/* Body: thumbnail + info + acciones */}
                <div className="flex flex-1 min-h-0">

                  {/* Miniatura */}
                  <div className="flex-shrink-0 p-3 pr-0 flex items-start pt-4">
                    <FotoThumb
                      url={fotosMap[p.id] ?? null}
                      alt={p.descripcion ?? ''}
                      width={54}
                      height={54}
                      radius="0.5rem"
                    />
                  </div>

                  {/* ── Panel izquierdo: info ───────────────────────── */}
                  <div className="flex-1 min-w-0 p-4 space-y-2.5">

                    {/* Row 1: tracking + city + link */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-xs font-bold truncate" style={{ color: '#F5B800' }}>
                        {p.tracking_origen ?? p.tracking_casilla}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                        style={{ background: enCamino ? 'rgba(99,102,241,0.12)' : 'rgba(52,211,153,0.1)', color: enCamino ? '#818cf8' : '#34d399', border: `1px solid ${enCamino ? 'rgba(99,102,241,0.25)' : 'rgba(52,211,153,0.2)'}` }}>
                        {enCamino ? '🚴 En camino' : `📍 ${BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}`}
                      </span>
                      <Link href={`/admin/paquetes/${p.id}`}
                        className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium transition-all hover:opacity-80 flex-shrink-0"
                        style={{ background: `${tw}0.06)`, color: `${tw}0.4)`, border: `1px solid ${tw}0.09)` }}>
                        <ExternalLink className="h-2.5 w-2.5" />
                        Ver / Editar
                      </Link>
                    </div>

                    {/* Row 2: descripción */}
                    <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{p.descripcion}</p>

                    {/* Row 3: cliente */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-3 w-3 flex-shrink-0" style={{ color: `${tw}0.3)` }} />
                        <span className="text-xs font-semibold text-white truncate">
                          {cli?.nombre_completo ?? <span style={{ color: `${tw}0.35)` }}>Sin asignar</span>}
                        </span>
                        {cli?.numero_casilla && (
                          <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color: '#F5B800' }}>
                            {cli.numero_casilla}
                          </span>
                        )}
                        {p.cliente_id && clientesConMultiples.has(p.cliente_id) && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
                            +paquetes
                          </span>
                        )}
                      </div>
                      {tel && (
                        <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] w-fit hover:underline"
                          style={{ color: '#34d399' }}>
                          <Phone className="h-3 w-3" />
                          {tel}
                        </a>
                      )}
                    </div>

                    {/* Row 4: dirección */}
                    {direccion ? (
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                        <div>
                          <p style={{ color: `${tw}0.7)` }}>{direccion}</p>
                          {(barrio || referencia) && (
                            <p className="text-[10px] mt-0.5" style={{ color: `${tw}0.38)` }}>
                              {[barrio, referencia].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg w-fit"
                        style={{ background: 'rgba(245,184,0,0.07)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.15)' }}>
                        <MapPin className="h-3 w-3" />
                        Sin dirección registrada
                      </div>
                    )}

                    {/* Row 5: meta + factura */}
                    <div className="flex items-center gap-3 flex-wrap pt-0.5">
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: `${tw}0.38)` }}>
                        {p.peso_libras && <span>⚖️ {Number(p.peso_libras).toFixed(1)} lb</span>}
                        {p.costo_servicio && <span>💵 ${Number(p.costo_servicio).toFixed(2)}</span>}
                        {dias !== null && (
                          <span style={{ color: dias > 7 ? '#f87171' : dias > 3 ? '#f59e0b' : `${tw}0.35)` }}>
                            🕐 {dias === 0 ? 'Hoy' : `${dias}d`}
                          </span>
                        )}
                      </div>
                      <FacturaBadge
                        facturaId={p.factura_id ?? null}
                        facturaPagada={p.factura_pagada ?? null}
                        costoServicio={p.costo_servicio ?? null}
                        size="xs"
                      />
                    </div>
                  </div>

                  {/* Separador vertical */}
                  <div className="w-px my-3 flex-shrink-0" style={{ background: `${tw}0.06)` }} />

                  {/* ── Panel derecho: acciones ─────────────────────── */}
                  <div className="w-48 p-3 flex flex-col gap-2 justify-center flex-shrink-0">
                    {domiciliarios.length > 0 && (
                      <AsignarDomiciliarioButton
                        paqueteId={p.id}
                        descripcion={p.descripcion ?? ''}
                        domiciliarios={domiciliarios}
                        domiciliarioActual={p.domiciliario_id
                          ? { id: p.domiciliario_id, nombre_completo: domMap[p.domiciliario_id] ?? 'Domiciliario' }
                          : null}
                      />
                    )}
                    <EntregarPaqueteButton
                      paqueteId={p.id}
                      tracking={p.tracking_casilla ?? ''}
                      descripcion={p.descripcion ?? ''}
                      clienteEmail={cli?.email ?? null}
                    />
                  </div>
                </div>

                {/* Paquetes pendientes — full width, al fondo */}
                {nPend > 0 && (
                  <details className="border-t" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                    <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none list-none"
                      style={{ background: 'rgba(239,68,68,0.06)' }}>
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#f87171' }} />
                      <p className="text-xs flex-1" style={{ color: '#f87171' }}>
                        <strong>{nPend}</strong> paquete{nPend !== 1 ? 's' : ''} pendiente{nPend !== 1 ? 's' : ''} por llegar · ver
                      </p>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(248,113,113,0.5)' }}>▼</span>
                    </summary>
                    <div>
                      {paqPend.map(pp => (
                        <Link key={pp.id} href={`/admin/paquetes/${pp.id}`}
                          className="flex items-center gap-3 px-4 py-2 hover:opacity-80 transition-opacity"
                          style={{ background: 'rgba(239,68,68,0.03)', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-white">{pp.descripcion ?? 'Sin descripción'}</p>
                            <p className="text-[10px] font-mono" style={{ color: `${tw}0.35)` }}>{pp.tracking_origen ?? pp.tracking_casilla ?? '—'}</p>
                          </div>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                            {ESTADO_LABELS_PENDIENTE[pp.estado] ?? pp.estado}
                          </span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: `${tw}0.25)` }} />
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
