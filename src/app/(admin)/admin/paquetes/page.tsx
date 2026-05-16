export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Search } from 'lucide-react'
import PaquetesTablaClient from '@/components/admin/PaquetesTablaClient'
import LimitSelector from '@/components/ui/LimitSelector'

const ESTADO_LABELS_LOCAL: Record<string, string> = {
  reportado: 'Reportado', recibido_usa: 'Recibido USA', en_consolidacion: 'En consolidación',
  listo_envio: 'Listo envío', en_transito: 'En tránsito', en_colombia: 'En Colombia',
  en_bodega_local: 'En bodega local', en_camino_cliente: 'En camino', entregado: 'Entregado',
  retenido: 'Retenido', devuelto: 'Devuelto',
}

const ESTADOS = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente',
  'entregado', 'retenido', 'devuelto',
]

const BODEGAS = ['medellin', 'bogota', 'barranquilla']
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface Props {
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string; asignacion?: string; consolidacion?: string; cliente_id?: string; limite?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q, asignacion, consolidacion, cliente_id } = params
  const limite = [10, 50, 100].includes(Number(params.limite)) ? Number(params.limite) : 50

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  // Cuando hay búsqueda de texto, primero resolvemos los cliente_id que coincidan
  // con nombre o número de casilla — así el filtro se aplica en DB, no en memoria.
  let clienteIdsDeQ: string[] | null = null
  if (q) {
    const { data: perfilesQ } = await supabase
      .from('perfiles')
      .select('id')
      .or(`nombre_completo.ilike.%${q}%,numero_casilla.ilike.%${q}%`)
    clienteIdsDeQ = (perfilesQ ?? []).map((p: { id: string }) => p.id)
  }

  let q1 = supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_facturable, peso_libras, costo_servicio, valor_declarado, factura_id, factura_pagada, requiere_consolidacion, notas_consolidacion, notas_internas, nombre_etiqueta, fecha_recepcion_usa, created_at, updated_at, paquete_origen_id, caja_id')
    .order('created_at', { ascending: false })
    .limit(q ? 500 : limite)  // sin límite estricto al buscar

  if (estado) q1 = q1.eq('estado', estado)
  if (bodega) q1 = q1.eq('bodega_destino', bodega)
  if (cliente_id) q1 = q1.eq('cliente_id', cliente_id)
  else if (asignacion === 'sin_asignar') q1 = q1.is('cliente_id', null)
  else if (asignacion === 'asignados') q1 = q1.not('cliente_id', 'is', null)
  if (consolidacion === 'requiere') q1 = q1.eq('requiere_consolidacion', true)
  else if (consolidacion === 'despachable') q1 = q1.eq('requiere_consolidacion', false)

  // Filtro de texto en DB: tracking, descripcion, tienda, nombre_etiqueta y clientes
  if (q) {
    const orParts = [
      `tracking_casilla.ilike.%${q}%`,
      `tracking_origen.ilike.%${q}%`,
      `descripcion.ilike.%${q}%`,
      `tienda.ilike.%${q}%`,
      `nombre_etiqueta.ilike.%${q}%`,
    ]
    if (clienteIdsDeQ && clienteIdsDeQ.length > 0) {
      orParts.push(`cliente_id.in.(${clienteIdsDeQ.join(',')})`)
    }
    q1 = q1.or(orParts.join(','))
  }

  const { data: paquetes, error: errPaq } = await q1
  const lista = paquetes ?? []

  const paqueteIds = lista.map(p => p.id)
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))]

  // Fetch all children of packages in the list to know division status
  const allIds = lista.map(p => p.id)
  const { data: hijosData } = allIds.length > 0
    ? await supabase
        .from('paquetes')
        .select('id, paquete_origen_id, estado')
        .in('paquete_origen_id', allIds)
    : { data: [] as { id: string; paquete_origen_id: string; estado: string }[] }

  const childrenByParent: Record<string, { id: string; estado: string }[]> = {}
  for (const h of (hijosData ?? [])) {
    if (!h.paquete_origen_id) continue
    if (!childrenByParent[h.paquete_origen_id]) childrenByParent[h.paquete_origen_id] = []
    childrenByParent[h.paquete_origen_id].push({ id: h.id, estado: h.estado })
  }

  const [perfilesRes, fotosRes, consolidacionUsaRes, cajasRes] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from('perfiles').select('id, nombre_completo, numero_casilla').in('id', clienteIds)
      : Promise.resolve({ data: [] }),
    paqueteIds.length > 0
      ? supabase.from('fotos_paquetes').select('paquete_id, url, descripcion, created_at').in('paquete_id', paqueteIds).order('created_at')
      : Promise.resolve({ data: [] }),
    clienteIds.length > 0
      ? supabase
          .from('paquetes')
          .select('cliente_id')
          .in('estado', ['recibido_usa', 'en_consolidacion', 'listo_envio'])
          .in('cliente_id', clienteIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('cajas_consolidacion')
      .select('id, codigo_interno, bodega_destino, estado, tipo')
      .in('estado', ['abierta', 'cerrada'])
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string }> =
    Object.fromEntries((perfilesRes.data ?? []).map((p: { id: string; nombre_completo: string; numero_casilla: string }) => [p.id, p]))

  // Group fotos by paquete_id
  const fotosGrupo: Record<string, { url: string; descripcion?: string | null; created_at: string }[]> = {}
  for (const f of (fotosRes.data ?? []) as { paquete_id: string; url: string; descripcion?: string | null; created_at: string }[]) {
    if (!fotosGrupo[f.paquete_id]) fotosGrupo[f.paquete_id] = []
    fotosGrupo[f.paquete_id].push(f)
  }
  // Pick product/content photo for each package
  const fotosMap: Record<string, string> = {}
  for (const [pid, fotos] of Object.entries(fotosGrupo)) {
    const sorted = [...fotos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const contenido = sorted.find(f => (f.descripcion ?? '').toLowerCase().includes('contenido'))
    const thumb = contenido ?? (sorted.length > 1 ? sorted[1] : sorted[0])
    if (thumb) fotosMap[pid] = thumb.url
  }

  // Build consolidacionMap: cliente_id → count of packages in US states
  const consolidacionMap: Record<string, number> = {}
  for (const row of (consolidacionUsaRes.data ?? []) as { cliente_id: string | null }[]) {
    if (!row.cliente_id) continue
    consolidacionMap[row.cliente_id] = (consolidacionMap[row.cliente_id] ?? 0) + 1
  }

  const filtrados = lista

  const cajasActivas = (cajasRes.data ?? []) as { id: string; codigo_interno: string; bodega_destino: string | null; estado: string; tipo: string | null }[]

  const paquetesConCliente = filtrados.map(p => ({
    ...p,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    fotoUrl: fotosMap[p.id] ?? null,
    paquete_origen_id: p.paquete_origen_id ?? null,
    notas_internas: p.notas_internas ?? null,
    caja_id: p.caja_id ?? null,
  }))

  const selectClass = "glass-input text-sm px-3 py-2 rounded-xl"

  // Si hay filtro por cliente, obtener su nombre para mostrarlo
  let nombreCliente: string | null = null
  if (cliente_id) {
    const perfilFiltrado = Object.values(perfilesMap).find((_, i) => Object.keys(perfilesMap)[i] === cliente_id)
      ?? (await supabase.from('perfiles').select('nombre_completo, numero_casilla').eq('id', cliente_id).single()).data
    if (perfilFiltrado) nombreCliente = `${perfilFiltrado.nombre_completo} · ${perfilFiltrado.numero_casilla}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Paquetes</h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            {nombreCliente && <span style={{ color: '#F5B800' }}> · {nombreCliente}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LimitSelector actual={limite} />
          <Link
            href="/admin/paquetes/eliminados"
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5"
            style={{ color: `${tw}0.25)`, border: `1px solid ${tw}0.08)` }}
          >
            🗑 Log eliminados
          </Link>
          {cliente_id && (
            <Link href="/admin/clientes" className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: `${tw}0.6)`, border: `1px solid ${tw}0.12)` }}>
              ← Volver a clientes
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: `${tw}0.35)` }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar tracking, cliente, producto..."
            className="glass-input pl-9 pr-4 py-2 text-sm rounded-xl w-72"
          />
        </div>
        <select name="estado" defaultValue={estado ?? ''} className={selectClass}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS_LOCAL[e] ?? e}</option>)}
        </select>
        <select name="bodega" defaultValue={bodega ?? ''} className={selectClass}>
          <option value="">Todas las bodegas</option>
          {BODEGAS.map(b => <option key={b} value={b}>{BODEGA_LABELS[b]}</option>)}
        </select>
        <select name="asignacion" defaultValue={asignacion ?? ''} className={selectClass}>
          <option value="">Asignados y sin asignar</option>
          <option value="sin_asignar">⏳ Solo sin asignar</option>
          <option value="asignados">✓ Solo asignados</option>
        </select>
        <select name="consolidacion" defaultValue={consolidacion ?? ''} className={selectClass}>
          <option value="">Consolidación: cualquiera</option>
          <option value="requiere">📦 Requiere consolidar</option>
          <option value="despachable">🚀 Listo para despachar</option>
        </select>
        <button type="submit" className="btn-gold px-4 py-2 rounded-xl text-sm font-semibold">Filtrar</button>
        {(estado || bodega || q || asignacion || consolidacion || cliente_id) && (
          <Link href="/admin/paquetes" className="px-4 py-2 text-sm rounded-xl font-medium transition-all" style={{ color: `${tw}0.55)`, border: `1px solid ${tw}0.12)` }}>Limpiar</Link>
        )}
      </form>

      <PaquetesTablaClient
        paquetes={paquetesConCliente}
        error={errPaq?.message ?? null}
        consolidacionMap={consolidacionMap}
        childrenByParent={childrenByParent}
        cajasActivas={cajasActivas}
      />
    </div>
  )
}
