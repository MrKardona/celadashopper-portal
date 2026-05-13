// GET  /api/admin/cajas       — lista cajas con filtros y resumen
// POST /api/admin/cajas       — crea una caja nueva (estado=abierta)

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

// ─── GET: listar cajas ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const estado = req.nextUrl.searchParams.get('estado')
  const admin = getSupabaseAdmin()

  let query = admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, tipo, peso_estimado, peso_real, estado, notas, created_at, fecha_cierre, fecha_despacho, fecha_recepcion_colombia')
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) query = query.eq('estado', estado)

  const { data: cajas, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Conteo de paquetes por caja
  const cajaIds = (cajas ?? []).map(c => c.id)
  const conteoMap: Record<string, number> = {}
  if (cajaIds.length > 0) {
    const { data: paquetes } = await admin
      .from('paquetes')
      .select('caja_id')
      .in('caja_id', cajaIds)

    for (const p of paquetes ?? []) {
      if (p.caja_id) conteoMap[p.caja_id] = (conteoMap[p.caja_id] ?? 0) + 1
    }
  }

  const enriquecidas = (cajas ?? []).map(c => ({
    ...c,
    paquetes_count: conteoMap[c.id] ?? 0,
  }))

  return NextResponse.json({ cajas: enriquecidas })
}

// ─── POST: crear caja nueva ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    bodega_destino?: string
    tipo?: string
    courier?: string
    notas?: string
  }

  const tipoValido = ['correo', 'manejo'].includes(body.tipo ?? '') ? body.tipo : 'correo'

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('cajas_consolidacion')
    .insert({
      bodega_destino: body.bodega_destino ?? 'medellin',
      tipo: tipoValido,
      courier: body.courier ?? null,
      notas: body.notas ?? null,
      creada_por: user.id,
    })
    .select('id, codigo_interno, bodega_destino, tipo, estado, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, caja: data })
}
