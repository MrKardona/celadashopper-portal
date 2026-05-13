// GET /api/cron/usaco-sync — sincroniza estados USACO para paquetes activos
// Invocado por Vercel Cron cada 30 minutos

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'
import { USACO_ESTADO_A_EVENTO, insertarEventoTracking } from '@/lib/usaco/tracking'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  // Seguridad: requiere CRON_SECRET siempre — falla si no está configurado
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Paquetes activos con guía USACO asignada
  const { data: paquetes, error } = await supabase
    .from('paquetes')
    .select('id, tracking_usaco, estado_usaco, estado')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')
    .not('estado', 'in', '("entregado","devuelto")')

  if (error) {
    console.error('[usaco-sync] Error DB:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ ok: true, sincronizados: 0, mensaje: 'Sin paquetes activos con guía' })
  }

  // Guías únicas (varios paquetes pueden compartir guía)
  const guiasUnicas = [...new Set(paquetes.map(p => (p.tracking_usaco as string).trim()))]

  const resultados = await consultarGuias(guiasUnicas)
  if (resultados.length === 0) {
    return NextResponse.json({ ok: true, sincronizados: 0, mensaje: 'USACO sin respuesta' })
  }

  // Mapa guia → estado actual en USACO
  const estadoMap = new Map(
    resultados
      .filter(r => r.estado && r.estado !== 'No se encontró el tracking')
      .map(r => [r.guia.trim(), r.estado.trim()])
  )

  let actualizados = 0

  for (const paquete of paquetes) {
    const guia = (paquete.tracking_usaco as string).trim()
    const estadoUsaco = estadoMap.get(guia)

    if (!estadoUsaco) continue
    if (estadoUsaco === paquete.estado_usaco) continue // sin cambio

    const evento = USACO_ESTADO_A_EVENTO[estadoUsaco]

    // Insertar evento en timeline si tenemos mapeo
    if (evento) {
      await insertarEventoTracking(supabase, paquete.id, evento, 'usaco')
    }

    // Actualizar estado_usaco en paquete
    await supabase.from('paquetes').update({
      estado_usaco: estadoUsaco,
      usaco_sync_at: new Date().toISOString(),
    }).eq('id', paquete.id)

    actualizados++
  }

  console.log(`[usaco-sync] ${actualizados}/${paquetes.length} actualizados`)

  return NextResponse.json({
    ok: true,
    paquetes_consultados: paquetes.length,
    guias_unicas: guiasUnicas.length,
    actualizados,
  })
}
