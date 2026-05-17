// GET /api/admin/cajas/pendientes-colombia
// Cajas despachadas desde USA que aún no han sido recibidas en Colombia.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: cajas, error } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, peso_estimado, peso_real, fecha_despacho, estado, estado_usaco, created_at')
    .in('estado', ['despachada', 'cerrada'])
    .order('fecha_despacho', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas?.length) return NextResponse.json({ cajas: [] })

  // Conteo de paquetes por caja + breakdown de estados
  const cajaIds = cajas.map(c => c.id)
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('caja_id, estado')
    .in('caja_id', cajaIds)

  const conteo: Record<string, number> = {}
  const estadosPorCaja: Record<string, Record<string, number>> = {}
  for (const p of paquetes ?? []) {
    if (!p.caja_id) continue
    conteo[p.caja_id] = (conteo[p.caja_id] ?? 0) + 1
    if (!estadosPorCaja[p.caja_id]) estadosPorCaja[p.caja_id] = {}
    estadosPorCaja[p.caja_id][p.estado] = (estadosPorCaja[p.caja_id][p.estado] ?? 0) + 1
  }

  return NextResponse.json({
    cajas: cajas.map(c => ({
      ...c,
      paquetes_count: conteo[c.id] ?? 0,
      estados_paquetes: estadosPorCaja[c.id] ?? {},
    })),
  })
}
