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
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string; asignacion?: string; consolidacion?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q, asignacion, consolidacion } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q1 = supabase
    .from('paquetes')
    .select('id, tracking_casilla, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_facturable, peso_libras, costo_servicio, valor_declarado, factura_id, factura_pagada, requiere_consolidacion, notas_consolidacion, nombre_etiqueta, fecha_recepcion_usa, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado) q1 = q1.eq('estado', estado)
  if (bodega) q1 = q1.eq('bodega_destino', bodega)
  if (asignacion === 'sin_asignar') q1 = q1.is('cliente_id', null)
  else if (asignacion === 'asignados') q1 = q1.not('cliente_id', 'is', null)
  if (consolidacion === 'requiere') q1 = q1.eq('requiere_consolidacion', true)
  else if (consolidacion === 'despachable') q1 = q1.eq('requiere_consolidacion', false)

  const { data: paquetes, error: errPaq } = await q1
  const lista = paquetes ?? []

  const paqueteIds = lista.map(p => p.id)
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))]

  const [perfilesRes, fotosRes] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from('perfiles').select('id, nombre_completo, numero_casilla').in('id', clienteIds)
      : Promise.resolve({ data: [] }),
    paqueteIds.length > 0
      ? supabase.from('fotos_paquetes').select('paquete_id, url').in('paquete_id', paqueteIds).order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string }> =
    Object.fromEntries((perfilesRes.data ?? []).map((p: { id: string; nombre_completo: string; numero_casilla: string }) => [p.id, p]))

  const fotosMap: Record<string, string> = {}
  for (const f of (fotosRes.data ?? []) as { paquete_id: string; url: string }[]) {
    if (!fotosMap[f.paquete_id]) fotosMap[f.paquete_id] = f.url
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Paquetes</h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
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
        {(estado || bodega || q || asignacion || consolidacion) && (
          <Link href="/admin/paquetes" className="px-4 py-2 text-sm rounded-xl font-medium transition-all" style={{ color: `${tw}0.55)`, border: `1px solid ${tw}0.12)` }}>Limpiar</Link>
        )}
      </form>

      <PaquetesTablaClient
        paquetes={paquetesConCliente}
        error={errPaq?.message ?? null}
      />
    </div>
  )
}
