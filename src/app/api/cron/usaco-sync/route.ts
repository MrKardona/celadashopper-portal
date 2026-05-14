// GET /api/cron/usaco-sync — sincroniza estados USACO para paquetes activos
// Invocado por Vercel Cron cada 30 minutos

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'
import { USACO_ESTADO_A_EVENTO, insertarEventoTracking } from '@/lib/usaco/tracking'
import { notificarCambioEstado, notificarEstadoUsacoBogota } from '@/lib/notificaciones/por-estado'

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

  // Eventos USACO redundantes con CeladaShopper — ignorar siempre
  const IGNORAR_SIEMPRE = new Set(['RecibidoOrigen', 'IncluidoEnGuia', 'Pre-Alertado'])

  // Medellín: CeladaShopper hace la última milla, pero USACO avisa que llegó a Colombia
  const MEDELLIN_NOTIFICAR = new Set(['BodegaDestino'])

  // Bogotá: USACO maneja entrega completa → notificar cada paso relevante
  const BOGOTA_NOTIFICAR = new Set([
    'GuiaCreadaColaborador',    // 📧 guía asignada — carrier confirmó
    'TransitoInternacional',    // 📧 vuelo en camino
    'ProcesoDeAduana',          // 📧 en aduana colombiana
    'BodegaDestino',            // 📧 llegó a Colombia
    'EnRuta', 'En ruta transito', 'EnTransportadora', // 📧 transportadora en ruta
    'EntregaFallida',           // 📧 intento fallido
    'Entregado',                // 📱 WA + 📧 entregado
  ])

  // USACO estado que indica entrega final → actualizar paquete.estado
  const USACO_ES_ENTREGADO = new Set(['Entregado'])

  const supabase = getSupabase()

  // Paquetes activos con guía USACO asignada
  const { data: paquetes, error } = await supabase
    .from('paquetes')
    .select('id, tracking_usaco, estado_usaco, estado, bodega_destino')
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
    return NextResponse.json({ ok: true, paquetes_consultados: paquetes.length, guias_unicas: guiasUnicas.length, actualizados: 0, mensaje: 'USACO sin respuesta' })
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

    // 1. Skip si no hay estado o está en ignorar siempre
    if (!estadoUsaco) continue
    if (IGNORAR_SIEMPRE.has(estadoUsaco)) continue

    // 2. Skip si sin cambio
    if (estadoUsaco === paquete.estado_usaco) continue

    const evento = USACO_ESTADO_A_EVENTO[estadoUsaco]
    const esMedellin = !paquete.bodega_destino || paquete.bodega_destino === 'medellin'

    // 5-6. Deduplicar y insertar tracking event
    // Para Bogotá Entregado: NO insertar entregado_transporte — notificarCambioEstado insertará 'entregado'
    const debeInsertarEvento = evento && !(
      !esMedellin && USACO_ES_ENTREGADO.has(estadoUsaco) && evento === 'entregado_transporte'
    )

    if (debeInsertarEvento) {
      // Verificar que no exista ya ese evento para este paquete
      const { data: existente } = await supabase
        .from('paquetes_tracking')
        .select('id')
        .eq('paquete_id', paquete.id)
        .eq('evento', evento)
        .maybeSingle()

      if (!existente) {
        await insertarEventoTracking(supabase, paquete.id, evento, 'usaco')
      }
    }

    // 7. Armar updateData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      estado_usaco: estadoUsaco,
      usaco_sync_at: new Date().toISOString(),
    }
    if (!esMedellin && USACO_ES_ENTREGADO.has(estadoUsaco) && paquete.estado !== 'entregado') {
      updateData.estado = 'entregado'
    }

    // 8. Ejecutar update en DB
    await supabase.from('paquetes').update(updateData).eq('id', paquete.id)

    // 9. Notificaciones al cliente según ciudad
    const debeNotificar =
      ( esMedellin && MEDELLIN_NOTIFICAR.has(estadoUsaco)) ||
      (!esMedellin && BOGOTA_NOTIFICAR.has(estadoUsaco))

    if (debeNotificar) {
      if (!esMedellin && USACO_ES_ENTREGADO.has(estadoUsaco)) {
        // Bogotá Entregado → canal completo: WA (cs_entregado_jutpck) + email
        notificarCambioEstado(paquete.id, 'entregado').catch(err =>
          console.error(`[usaco-sync] notificarCambioEstado entregado paquete=${paquete.id}:`, err)
        )
      } else {
        // Medellín BodegaDestino / Bogotá otros (BodegaDestino, EnRuta, EntregaFallida) → email
        notificarEstadoUsacoBogota(paquete.id, estadoUsaco).catch(err =>
          console.error(`[usaco-sync] notificarEstadoUsacoBogota paquete=${paquete.id} estado=${estadoUsaco}:`, err)
        )
      }
    }

    // 10. Incrementar contador
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
