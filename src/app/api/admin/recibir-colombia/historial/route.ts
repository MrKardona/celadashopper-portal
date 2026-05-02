// GET /api/admin/recibir-colombia/historial
// Devuelve las cajas que ya fueron recibidas en Colombia (con sus paquetes).

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

  // Filtros: días=N para ver últimos N días (default 30), todos=1 para sin límite
  const dias = req.nextUrl.searchParams.get('dias')
  const todos = req.nextUrl.searchParams.get('todos') === '1'

  const admin = getSupabaseAdmin()

  let query = admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, peso_estimado, peso_real, costo_total_usaco, notas, created_at, fecha_despacho, fecha_recepcion_colombia')
    .eq('estado', 'recibida_colombia')
    .order('fecha_recepcion_colombia', { ascending: false })
    .limit(50)

  if (!todos) {
    const limiteDias = parseInt(dias ?? '30', 10) || 30
    const desde = new Date()
    desde.setDate(desde.getDate() - limiteDias)
    query = query.gte('fecha_recepcion_colombia', desde.toISOString())
  }

  const { data: cajas, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({ cajas: [] })
  }

  // Cargar conteo de paquetes y peso real por caja
  const cajaIds = cajas.map(c => c.id)
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('caja_id, estado, peso_libras')
    .in('caja_id', cajaIds)

  const conteoPorCaja: Record<string, { total: number; entregados: number; en_bodega: number }> = {}
  for (const p of paquetes ?? []) {
    if (!p.caja_id) continue
    if (!conteoPorCaja[p.caja_id]) conteoPorCaja[p.caja_id] = { total: 0, entregados: 0, en_bodega: 0 }
    conteoPorCaja[p.caja_id].total++
    if (p.estado === 'entregado') conteoPorCaja[p.caja_id].entregados++
    if (p.estado === 'en_bodega_local') conteoPorCaja[p.caja_id].en_bodega++
  }

  const enriquecidas = cajas.map(c => ({
    ...c,
    paquetes_count: conteoPorCaja[c.id]?.total ?? 0,
    paquetes_entregados: conteoPorCaja[c.id]?.entregados ?? 0,
    paquetes_en_bodega: conteoPorCaja[c.id]?.en_bodega ?? 0,
  }))

  return NextResponse.json({ cajas: enriquecidas })
}
