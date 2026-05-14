// POST /api/admin/usaco/sync-cajas
// Consulta USACO y actualiza el estado de las cajas en estado 'despachada'

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'
import { USACO_ESTADO_A_EVENTO, insertarEventoTracking } from '@/lib/usaco/tracking'

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

// Estados USACO que indican que la caja ya llegó a Colombia
const ESTADOS_EN_COLOMBIA = new Set([
  'BodegaDestino',
  'EnRuta',
  'En ruta transito',
  'EnTransportadora',
  'EntregaFallida',
  'Entregado',
])

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // 1. Cajas despachadas con tracking USACO
  const { data: cajas, error } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco')
    .eq('estado', 'despachada')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: 0,
      actualizadas: 0,
      paquetes_notificados: 0,
      mensaje: 'No hay cajas despachadas con tracking USACO',
    })
  }

  // 2. Consultar USACO
  const trackings = cajas.map(c => (c.tracking_usaco as string).trim())
  const resultados = await consultarGuias(trackings)

  if (resultados.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: cajas.length,
      actualizadas: 0,
      paquetes_notificados: 0,
      mensaje: 'USACO no devolvió resultados',
    })
  }

  // Mapa guia → estado USACO
  const estadoMap = new Map(
    resultados
      .filter(r => r.estado && r.estado !== 'No se encontró el tracking')
      .map(r => [r.guia.trim(), r.estado.trim()])
  )

  let cajasActualizadas = 0
  let paquetesNotificados = 0
  const detalles: { caja: string; estado: string }[] = []
  const ahora = new Date().toISOString()

  for (const caja of cajas) {
    const tracking = (caja.tracking_usaco as string).trim()
    const estadoUsaco = estadoMap.get(tracking)

    if (!estadoUsaco) continue

    // Registrar estado consultado para el resumen
    detalles.push({ caja: caja.codigo_interno, estado: estadoUsaco })

    if (!ESTADOS_EN_COLOMBIA.has(estadoUsaco)) continue

    // 3. Marcar caja como recibida_colombia
    const { error: errCaja } = await admin
      .from('cajas_consolidacion')
      .update({ estado: 'recibida_colombia', fecha_recepcion_colombia: ahora })
      .eq('id', caja.id)

    if (errCaja) {
      console.error('[sync-cajas] Error actualizando caja', caja.codigo_interno, errCaja.message)
      continue
    }

    cajasActualizadas++

    // 4. Paquetes activos de esta caja — insertar evento llego_colombia si no existe
    const { data: paquetes } = await admin
      .from('paquetes')
      .select('id')
      .eq('caja_id', caja.id)
      .not('estado', 'in', '("entregado","devuelto")')

    if (!paquetes || paquetes.length === 0) continue

    const paqIds = paquetes.map(p => p.id)

    // Paquetes que ya tienen evento llego_colombia
    const { data: yaExisten } = await admin
      .from('paquetes_tracking')
      .select('paquete_id')
      .in('paquete_id', paqIds)
      .eq('evento', 'llego_colombia')

    const conEvento = new Set((yaExisten ?? []).map(e => e.paquete_id))

    for (const paquete of paquetes) {
      if (conEvento.has(paquete.id)) continue

      await insertarEventoTracking(
        admin,
        paquete.id,
        'llego_colombia',
        'usaco',
        `Caja ${caja.codigo_interno} recibida en Colombia`,
      )

      // Actualizar estado_usaco del paquete
      await admin.from('paquetes').update({
        estado_usaco: estadoUsaco,
        usaco_sync_at: ahora,
      }).eq('id', paquete.id)

      paquetesNotificados++
    }
  }

  return NextResponse.json({
    ok: true,
    consultadas: cajas.length,
    actualizadas: cajasActualizadas,
    paquetes_notificados: paquetesNotificados,
    detalles,
  })
}
