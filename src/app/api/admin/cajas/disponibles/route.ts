// GET /api/admin/cajas/disponibles?bodega=medellin&q=texto&todas=1
// Devuelve paquetes en estado recibido_usa, sin caja asignada, listos para meter en una caja.
// Por defecto filtra por bodega; pasar todas=1 para mostrar de todas las bodegas.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const bodega = req.nextUrl.searchParams.get('bodega')
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const todasBodegas = req.nextUrl.searchParams.get('todas') === '1'
  // Estados elegibles para meter en una caja (CSV).
  // Default: recibido_usa, listo_envio, en_consolidacion (los huérfanos sin caja_id)
  const estadosParam = req.nextUrl.searchParams.get('estados')?.trim()
  const estadosElegibles = estadosParam
    ? estadosParam.split(',').map(s => s.trim()).filter(Boolean)
    : ['recibido_usa', 'listo_envio', 'en_consolidacion']

  const admin = getSupabaseAdmin()

  let query = admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, categoria, peso_libras, cliente_id, bodega_destino, fecha_recepcion_usa, estado')
    .in('estado', estadosElegibles)
    .is('caja_id', null)
    // Permitimos paquetes sin cliente (huérfanos): se pueden despachar igualmente
    .order('fecha_recepcion_usa', { ascending: true })
    .limit(80)

  if (bodega && !todasBodegas) {
    query = query.eq('bodega_destino', bodega)
  }

  if (q.length > 0) {
    const term = `%${q}%`
    query = query.or(
      `tracking_casilla.ilike.${term},tracking_origen.ilike.${term},descripcion.ilike.${term}`
    )
  }

  const { data: paquetes, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cargar perfiles
  const clienteIds = [...new Set((paquetes ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string | null }> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla')
      .in('id', clienteIds)
    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = { nombre_completo: p.nombre_completo, numero_casilla: p.numero_casilla }
    }
  }

  // Conteos por estado (sin filtro q) para mostrar tabs
  const conteoPorEstado: Record<string, number> = {}
  for (const e of ['recibido_usa', 'listo_envio', 'en_consolidacion']) {
    let countQuery = admin
      .from('paquetes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', e)
      .is('caja_id', null)
    // Cuenta también los paquetes sin cliente
    if (bodega && !todasBodegas) countQuery = countQuery.eq('bodega_destino', bodega)
    const { count } = await countQuery
    conteoPorEstado[e] = count ?? 0
  }

  const totalDisponibles = estadosElegibles.reduce(
    (sum, e) => sum + (conteoPorEstado[e] ?? 0),
    0,
  )

  const enriquecidos = (paquetes ?? []).map(p => ({
    ...p,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
  }))

  return NextResponse.json({
    paquetes: enriquecidos,
    total_disponibles: totalDisponibles,
    mostrando: enriquecidos.length,
    conteo_por_estado: conteoPorEstado,
  })
}
