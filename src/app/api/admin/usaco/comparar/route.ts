// GET /api/admin/usaco/comparar
// Cruza todas las cajas con tracking_usaco en BD contra la API de USACO.
// Devuelve: cajas reconocidas, no reconocidas, y diferencias de estado.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // 1. Todas las cajas con tracking USACO asignado
  const { data: cajas } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, estado, estado_usaco, tipo, bodega_destino, created_at, fecha_despacho')
    .not('tracking_usaco', 'is', null)
    .order('created_at', { ascending: false })

  const cajasConTracking = (cajas ?? []).filter(c => c.tracking_usaco?.trim())

  if (cajasConTracking.length === 0) {
    return NextResponse.json({ ok: true, filas: [], total_bd: 0, reconocidas: 0, no_reconocidas: 0 })
  }

  // 2. Consultar USACO para esas guías
  const guias = cajasConTracking.map(c => (c.tracking_usaco as string).trim())
  const resultadosUsaco = await consultarGuias(guias)

  // Mapa guia → resultado USACO
  const usacoMap = new Map(
    resultadosUsaco.map(r => [r.guia.trim(), r])
  )

  // 3. Cruzar
  const filas = cajasConTracking.map(caja => {
    const guia = (caja.tracking_usaco as string).trim()
    const usaco = usacoMap.get(guia)
    const reconocida = !!usaco && usaco.estado !== 'No se encontró el tracking'
    const estadoUsaco = reconocida ? usaco!.estado : null

    const sincronizado = reconocida
      ? (caja.estado_usaco ?? null) === estadoUsaco
      : null

    return {
      caja_id: caja.id,
      codigo_interno: caja.codigo_interno,
      tracking_usaco: guia,
      tipo: caja.tipo ?? 'correo',
      bodega_destino: caja.bodega_destino,
      estado_bd: caja.estado,
      estado_usaco_bd: caja.estado_usaco ?? null,
      estado_usaco_api: estadoUsaco,
      reconocida,
      sincronizado,
      created_at: caja.created_at,
      fecha_despacho: caja.fecha_despacho ?? null,
    }
  })

  const reconocidas = filas.filter(f => f.reconocida).length
  const no_reconocidas = filas.filter(f => !f.reconocida).length
  const desincronizadas = filas.filter(f => f.reconocida && !f.sincronizado).length

  return NextResponse.json({
    ok: true,
    filas,
    total_bd: cajasConTracking.length,
    reconocidas,
    no_reconocidas,
    desincronizadas,
    consultadas_usaco: resultadosUsaco.length,
  })
}
