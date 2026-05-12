export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Search } from 'lucide-react'
import PaquetesTablaClient from '@/components/admin/PaquetesTablaClient'

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
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string; asignacion?: string; consolidacion?: string; cliente_id?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q, asignacion, consolidacion, cliente_id } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q1 = supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_facturable, peso_libras, costo_servicio, valor_declarado, factura_id, factura_pagada, requiere_consolidacion, notas_consolidacion, nombre_etiqueta, fecha_recepcion_usa, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado) q1 = q1.eq('estado', estado)
  if (bodega) q1 = q1.eq('bodega_destino', bodega)
  if (cliente_id) q1 = q1.eq('cliente_id', cliente_id)
  else if (asignacion === 'sin_asignar') q1 = q1.is('cliente_id', null)
  else if (asignacion === 'asignados') q1 = q1.not('cliente_id', 'is', null)
  if (consolidacion === 'requiere') q1 = q1.eq('requiere_consolidacion', true)
  else if (consolidacion === 'despachable') q1 = q1.eq('requiere_consolidacion', false)

  const { data: paquetes, error: errPaq } = await q1
  const lista = paquetes ?? []

  const paqueteIds = lista.map(p => p.id)
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))]

  const [perfilesRes, fotosRes, consolidacionUsaRes] = await Promise.all([
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

  const filtrados = q
    ? lista.filter(p => {
        const perfil = p.cliente_id ? perfilesMap[p.cliente_id] : null
        const txt = `${p.tracking_casilla} ${p.descripcion} ${p.tienda} ${p.nombre_etiqueta ?? ''} ${perfil?.nombre_completo ?? ''} ${perfil?.numero_casilla ?? ''}`.toLowerCase()
        return txt.includes(q.toLowerCase())
      })
    : lista

  const paquetesConCliente = filtrados.map(p => ({
    ...p,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    fotoUrl: fotosMap[p.id] ?? null,
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
        {cliente_id && (
          <Link href="/admin/clientes" className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: `${tw}0.6)`, border: `1px solid ${tw}0.12)` }}>
            ← Volver a clientes
          </Link>
        )}
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
      />
    </div>
  )
}
