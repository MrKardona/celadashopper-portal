// GET /api/admin/cajas/disponibles?bodega=medellin&q=texto&todas=1&incluir_otras=1
// Devuelve paquetes en estado recibido_usa/listo_envio/en_consolidacion listos para
// meter en una caja. Por defecto solo trae paquetes sin caja asignada.
// Parámetros:
//   bodega          → bodega destino del paquete
//   todas=1         → ignora filtro de bodega
//   incluir_otras=1 → ADEMÁS incluye paquetes que ya están en otras cajas ABIERTAS
//                     (para moverlos). Cada paquete trae caja_actual = { id, codigo_interno }
//                     o null si está libre.
//   estados         → CSV con estados elegibles (default los 3)
//   q               → búsqueda libre por tracking/descripción

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
  const incluirOtras = req.nextUrl.searchParams.get('incluir_otras') === '1'
  const excluirCajaId = req.nextUrl.searchParams.get('excluir_caja')?.trim() ?? null
  // Estados elegibles para meter en una caja (CSV).
  const estadosParam = req.nextUrl.searchParams.get('estados')?.trim()
  const estadosElegibles = estadosParam
    ? estadosParam.split(',').map(s => s.trim()).filter(Boolean)
    : ['recibido_usa', 'listo_envio', 'en_consolidacion']

  const admin = getSupabaseAdmin()

  let query = admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, categoria, peso_libras, valor_declarado, cliente_id, bodega_destino, fecha_recepcion_usa, estado, caja_id')
    .in('estado', estadosElegibles)
    .order('fecha_recepcion_usa', { ascending: true })
    .limit(120)

  // Por defecto solo paquetes sin caja. Si se pide incluir_otras, traemos también los
  // que están en cajas abiertas — el filtrado por estado de caja se hace abajo.
  if (!incluirOtras) {
    query = query.is('caja_id', null)
  }

  if (bodega && !todasBodegas) {
    query = query.eq('bodega_destino', bodega)
  }

  if (q.length > 0) {
    const term = `%${q}%`
    query = query.or(
      `tracking_casilla.ilike.${term},tracking_origen.ilike.${term},descripcion.ilike.${term}`
    )
  }

  const { data: paquetesRaw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si pidieron incluir paquetes de otras cajas: filtrar para incluir solo
  // aquellos cuyas cajas están en estado "abierta" (no cerrada/despachada).
  let paquetes = paquetesRaw ?? []
  const cajasMap: Record<string, { id: string; codigo_interno: string; estado: string }> = {}
  if (incluirOtras) {
    const cajaIdsRefs = [...new Set(paquetes.map(p => p.caja_id).filter(Boolean))] as string[]
    if (cajaIdsRefs.length > 0) {
      const { data: cajasInfo } = await admin
        .from('cajas_consolidacion')
        .select('id, codigo_interno, estado')
        .in('id', cajaIdsRefs)
      for (const c of cajasInfo ?? []) cajasMap[c.id] = c
    }
    // Filtrar: solo dejamos paquetes sin caja, o con caja en estado "abierta"
    // y excluimos la caja indicada (la actual que estamos viendo).
    paquetes = paquetes.filter(p => {
      if (!p.caja_id) return true
      const c = cajasMap[p.caja_id]
      if (!c || c.estado !== 'abierta') return false
      if (excluirCajaId && p.caja_id === excluirCajaId) return false
      return true
    })
  }

  // Cargar perfiles
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
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

  // Conteos por estado (con o sin caja según incluirOtras)
  const conteoPorEstado: Record<string, number> = {}
  for (const e of ['recibido_usa', 'listo_envio', 'en_consolidacion']) {
    let countQuery = admin
      .from('paquetes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', e)
    if (!incluirOtras) countQuery = countQuery.is('caja_id', null)
    if (bodega && !todasBodegas) countQuery = countQuery.eq('bodega_destino', bodega)
    const { count } = await countQuery
    conteoPorEstado[e] = count ?? 0
  }

  const totalDisponibles = estadosElegibles.reduce(
    (sum, e) => sum + (conteoPorEstado[e] ?? 0),
    0,
  )

  const enriquecidos = paquetes.map(p => ({
    ...p,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    caja_actual: p.caja_id && cajasMap[p.caja_id]
      ? { id: p.caja_id, codigo_interno: cajasMap[p.caja_id].codigo_interno }
      : null,
  }))

  return NextResponse.json({
    paquetes: enriquecidos,
    total_disponibles: totalDisponibles,
    mostrando: enriquecidos.length,
    conteo_por_estado: conteoPorEstado,
  })
}
