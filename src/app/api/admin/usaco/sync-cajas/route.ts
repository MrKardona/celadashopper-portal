// POST /api/admin/usaco/sync-cajas
// Consulta USACO y actualiza estado de cajas + paquetes individuales dentro de ellas

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'
import { USACO_ESTADO_A_EVENTO, insertarEventoTracking } from '@/lib/usaco/tracking'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return admin
}

// USACO estados que indican que la caja llegó a Colombia
const ESTADOS_EN_COLOMBIA = new Set([
  'BodegaDestino', 'EnRuta', 'En ruta transito',
  'EnTransportadora', 'EntregaFallida', 'Entregado',
])

// USACO estados que se ignoran (ya los inserta CeladaShopper)
const IGNORAR_SIEMPRE = new Set(['RecibidoOrigen', 'IncluidoEnGuia', 'Pre-Alertado'])

// Medellín: solo TransitoInternacional dispara WA+email al cliente
const MEDELLIN_NOTIFICAR = new Set(['TransitoInternacional'])

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // 1. Cajas despachadas con tracking USACO
  const { data: cajas, error } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, estado_usaco, bodega_destino')
    .eq('estado', 'despachada')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: 0,
      actualizadas: 0,
      paquetes_actualizados: 0,
      mensaje: 'No hay cajas despachadas con tracking USACO',
    })
  }

  // 2. Consultar USACO (guías únicas)
  const trackingsUnicos = [...new Set(cajas.map(c => (c.tracking_usaco as string).trim()))]
  const resultados = await consultarGuias(trackingsUnicos)

  if (resultados.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: cajas.length,
      actualizadas: 0,
      paquetes_actualizados: 0,
      mensaje: 'USACO no devolvió resultados',
    })
  }

  // Mapa guia → estado USACO
  const estadoMap = new Map(
    resultados
      .filter(r => r.estado && r.estado !== 'No se encontró el tracking')
      .map(r => [r.guia.trim(), r.estado.trim()])
  )

  const ahora = new Date().toISOString()
  let cajasActualizadas = 0
  let paquetesActualizados = 0

  for (const caja of cajas) {
    const tracking = (caja.tracking_usaco as string).trim()
    const estadoUsaco = estadoMap.get(tracking)

    if (!estadoUsaco || IGNORAR_SIEMPRE.has(estadoUsaco)) continue

    const llegoColombia = ESTADOS_EN_COLOMBIA.has(estadoUsaco)
    const esMedellin = !caja.bodega_destino || caja.bodega_destino === 'medellin'

    // ── 3. Actualizar caja ────────────────────────────────────────────────────
    const updateCaja: Record<string, unknown> = {
      estado_usaco: estadoUsaco,
      usaco_sync_at: ahora,
    }
    if (llegoColombia) {
      updateCaja.estado = 'recibida_colombia'
      updateCaja.fecha_recepcion_colombia = ahora
    }

    await admin
      .from('cajas_consolidacion')
      .update(updateCaja)
      .eq('id', caja.id)

    if (estadoUsaco !== caja.estado_usaco) cajasActualizadas++

    // ── 4. Cargar paquetes activos de la caja ────────────────────────────────
    const { data: paquetes } = await admin
      .from('paquetes')
      .select('id, estado, estado_usaco, cliente_id, visible_cliente')
      .eq('caja_id', caja.id)
      .not('estado', 'in', '("entregado","devuelto")')

    if (!paquetes || paquetes.length === 0) continue

    for (const paquete of paquetes) {
      // Sin cambio → skip
      if (estadoUsaco === paquete.estado_usaco) continue

      const evento = USACO_ESTADO_A_EVENTO[estadoUsaco]

      // Deduplicar evento en paquetes_tracking
      let eventoFueNuevo = false
      if (evento) {
        const { data: existente } = await admin
          .from('paquetes_tracking')
          .select('id')
          .eq('paquete_id', paquete.id)
          .eq('evento', evento)
          .maybeSingle()

        if (!existente) {
          await insertarEventoTracking(admin, paquete.id, evento, 'usaco')
          eventoFueNuevo = true
        }
      }

      // Actualizar estado_usaco (y estado interno si aplica)
      const updatePaq: Record<string, unknown> = {
        estado_usaco: estadoUsaco,
        usaco_sync_at: ahora,
        updated_at: ahora,
      }

      // TransitoInternacional → en_transito
      if (estadoUsaco === 'TransitoInternacional' && paquete.estado !== 'en_transito') {
        updatePaq.estado = 'en_transito'
      }
      // BodegaDestino → en_colombia
      if (estadoUsaco === 'BodegaDestino' && !['en_colombia', 'en_bodega_local', 'entregado'].includes(paquete.estado)) {
        updatePaq.estado = 'en_colombia'
      }

      await admin.from('paquetes').update(updatePaq).eq('id', paquete.id)
      paquetesActualizados++

      // Notificación al cliente (solo si el evento fue nuevo y el paquete es visible)
      const esSubPaquete = paquete.visible_cliente === false
      if (!esSubPaquete && eventoFueNuevo && esMedellin && MEDELLIN_NOTIFICAR.has(estadoUsaco)) {
        notificarCambioEstado(paquete.id, 'en_transito').catch(err =>
          console.error(`[sync-cajas] notif paquete=${paquete.id}:`, err)
        )
      }
    }
  }

  return NextResponse.json({
    ok: true,
    consultadas: cajas.length,
    actualizadas: cajasActualizadas,
    paquetes_actualizados: paquetesActualizados,
  })
}
