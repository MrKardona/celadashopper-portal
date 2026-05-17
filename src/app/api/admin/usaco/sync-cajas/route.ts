// POST /api/admin/usaco/sync-cajas
// Consulta USACO, actualiza estado en cajas Y propaga cambios a paquetes.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'
import { insertarEventoTracking } from '@/lib/tracking'

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

// Ignora estados internos de USACO que no representan progreso real
const IGNORAR = new Set(['RecibidoOrigen', 'IncluidoEnGuia', 'Pre-Alertado', 'GuiaCreadaColaborador'])

// Estado USACO → estado interno del paquete
// Solo se aplica si el paquete está en un estado ANTERIOR (ver orden abajo)
const USACO_A_ESTADO_PAQ: Record<string, string> = {
  'TransitoInternacional': 'en_transito',
  'ProcesoDeAduana':       'en_transito',
  'BodegaDestino':         'en_colombia',
  'EnRuta':                'en_colombia',
  'En ruta transito':      'en_colombia',
  'EnTransportadora':      'en_colombia',
  'EntregaFallida':        'en_colombia',
  // 'Entregado': NO — entrega se confirma manualmente con foto
}

// Estado USACO → evento de tracking visible al cliente
const USACO_A_EVENTO_TRACKING: Record<string, string> = {
  'TransitoInternacional': 'transito_internacional',
  'ProcesoDeAduana':       'proceso_aduana',
  'BodegaDestino':         'llego_colombia',
  'EnRuta':                'en_ruta',
  'En ruta transito':      'en_ruta_transito',
  'EnTransportadora':      'en_transportadora',
  'EntregaFallida':        'entrega_fallida',
}

// Orden de estados para decidir si avanzar o no
const ORDEN_ESTADO: Record<string, number> = {
  reportado:         0,
  recibido_usa:      1,
  en_consolidacion:  2,
  listo_envio:       3,
  en_transito:       4,
  en_colombia:       5,
  en_bodega_local:   6,
  en_camino_cliente: 7,
  entregado:         8,
}

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // 1. Cajas despachadas con tracking USACO
  const { data: cajas, error } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, estado_usaco')
    .eq('estado', 'despachada')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({
      ok: true, consultadas: 0, actualizadas: 0,
      mensaje: 'No hay cajas despachadas con tracking USACO',
    })
  }

  // Solo cajas con tracking numérico válido
  const esNumerico = (g: string) => /^\d+$/.test(g.trim())
  const cajasValidas = cajas.filter(c => esNumerico(c.tracking_usaco as string))

  // 2. Consultar USACO — enviamos los números tal cual (con ceros incluidos)
  const trackingsUnicos = [...new Set(cajasValidas.map(c => (c.tracking_usaco as string).trim()))]
  const resultados = await consultarGuias(trackingsUnicos)

  if (resultados.length === 0) {
    return NextResponse.json({
      ok: true, consultadas: cajasValidas.length, actualizadas: 0,
      mensaje: 'USACO no devolvió resultados',
    })
  }

  // Mapa guia → estado (la guía puede venir con o sin ceros en la respuesta)
  // Normalizamos SOLO para el lookup, comparando sin ceros en ambos lados
  const norm = (g: string) => g.trim().replace(/^0+/, '') || '0'
  const estadoMap = new Map(
    resultados
      .filter(r => r.estado && !r.estado.toLowerCase().includes('no se encontró'))
      .map(r => [norm(r.guia), r.estado.trim()])
  )

  const ahora = new Date().toISOString()
  let cajasActualizadas = 0
  let paquetesAvanzados = 0

  for (const caja of cajasValidas) {
    const tracking    = norm(caja.tracking_usaco as string)
    const estadoUsaco = estadoMap.get(tracking)

    // USACO no devolvió resultado para esta guía — saltar
    if (!estadoUsaco) continue

    const huboCambioCaja = estadoUsaco !== caja.estado_usaco

    // 3. Siempre guardar el estado USACO en la caja (incluye estados iniciales como
    //    RecibidoOrigen, GuiaCreadaColaborador, etc.) para que el admin los vea.
    await admin
      .from('cajas_consolidacion')
      .update({ estado_usaco: estadoUsaco, usaco_sync_at: ahora })
      .eq('id', caja.id)

    if (huboCambioCaja) cajasActualizadas++

    // 4. Propagar a paquetes SOLO si el estado representa progreso real
    //    (estados en IGNORAR son administrativos/iniciales, no se propagan)
    if (IGNORAR.has(estadoUsaco)) continue

    const estadoNuevoPaq = USACO_A_ESTADO_PAQ[estadoUsaco]
    const eventoTracking = USACO_A_EVENTO_TRACKING[estadoUsaco]

    if (!estadoNuevoPaq && !eventoTracking) continue

    // Cargar paquetes de la caja (excluyendo sub-paquetes y ya entregados)
    const { data: paquetes } = await admin
      .from('paquetes')
      .select('id, estado')
      .eq('caja_id', caja.id)
      .is('paquete_origen_id', null)     // solo paquetes principales
      .not('estado', 'in', '("entregado","devuelto","en_bodega_local","en_camino_cliente")')

    for (const paq of paquetes ?? []) {
      const ordenActual = ORDEN_ESTADO[paq.estado] ?? 0
      const ordenNuevo  = estadoNuevoPaq ? (ORDEN_ESTADO[estadoNuevoPaq] ?? 0) : 0

      // Solo avanzar estado, nunca retroceder
      if (estadoNuevoPaq && ordenNuevo > ordenActual) {
        const { error: errPaq } = await admin
          .from('paquetes')
          .update({ estado: estadoNuevoPaq, updated_at: ahora })
          .eq('id', paq.id)

        if (!errPaq) {
          // Registrar evento interno
          await admin.from('eventos_paquete').insert({
            paquete_id:     paq.id,
            estado_anterior: paq.estado,
            estado_nuevo:   estadoNuevoPaq,
            descripcion:    `Actualizado vía USACO (${estadoUsaco}) — caja ${caja.codigo_interno}`,
            ubicacion:      estadoUsaco === 'TransitoInternacional' || estadoUsaco === 'ProcesoDeAduana'
              ? 'En tránsito'
              : 'Colombia',
          }).then(() => null, () => null)

          paquetesAvanzados++
        }
      }

      // Insertar evento de tracking visible al cliente (si aplica y no existe ya)
      if (eventoTracking) {
        const { data: existe } = await admin
          .from('paquetes_tracking')
          .select('id')
          .eq('paquete_id', paq.id)
          .eq('evento', eventoTracking)
          .maybeSingle()

        if (!existe) {
          await insertarEventoTracking(admin, paq.id, eventoTracking, 'usaco',
            `${estadoUsaco} — caja ${caja.codigo_interno}`)
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    consultadas:       cajas.length,
    actualizadas:      cajasActualizadas,
    paquetes_avanzados: paquetesAvanzados,
  })
}
