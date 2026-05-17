// PATCH /api/admin/paquetes/[id]
// Actualiza datos del paquete y dispara notificación WhatsApp si el estado cambia

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  notificarCambioEstado,
  notificarTrackingActualizado,
  notificarCostoCalculado,
} from '@/lib/notificaciones/por-estado'
import { consultarGuias } from '@/lib/usaco/cliente'
import { insertarEventoTracking } from '@/lib/tracking'

// ── Constantes USACO (mismas que en sync-cajas/route.ts) ─────────────────────
const USACO_IGNORAR = new Set(['RecibidoOrigen', 'IncluidoEnGuia', 'Pre-Alertado', 'GuiaCreadaColaborador'])
const USACO_A_ESTADO_PAQ: Record<string, string> = {
  'TransitoInternacional': 'en_transito',
  'ProcesoDeAduana':       'en_transito',
  'BodegaDestino':         'en_colombia',
  'EnRuta':                'en_colombia',
  'En ruta transito':      'en_colombia',
  'EnTransportadora':      'en_colombia',
  'EntregaFallida':        'en_colombia',
}
const USACO_A_EVENTO_TRACKING: Record<string, string> = {
  'TransitoInternacional': 'transito_internacional',
  'ProcesoDeAduana':       'proceso_aduana',
  'BodegaDestino':         'llego_colombia',
  'EnRuta':                'en_ruta',
  'En ruta transito':      'en_ruta_transito',
  'EnTransportadora':      'en_transportadora',
  'EntregaFallida':        'entrega_fallida',
}
const ORDEN_ESTADO: Record<string, number> = {
  reportado: 0, recibido_usa: 1, en_consolidacion: 2, listo_envio: 3,
  en_transito: 4, en_colombia: 5, en_bodega_local: 6, en_camino_cliente: 7, entregado: 8,
}
const normGuia = (g: string) => g.trim().replace(/^0+/, '') || '0'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Verificar que el usuario es admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const {
    estado, bodega_destino, categoria, descripcion, peso_libras, peso_facturable, tarifa_aplicada,
    costo_servicio, tracking_usaco, notas_cliente, condicion, cantidad, valor_declarado,
    notificar, estado_anterior, caja_id,
  } = body

  // Estado actual del paquete antes del update (para detectar cambios reales)
  const { data: paqueteAntes } = await supabaseAdmin
    .from('paquetes')
    .select('estado, tracking_usaco, costo_servicio, visible_cliente, paquete_origen_id, bodega_destino, caja_id')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = {}
  if (estado !== undefined) updates.estado = estado
  if (bodega_destino !== undefined) updates.bodega_destino = bodega_destino
  if (categoria !== undefined) updates.categoria = categoria
  if (descripcion !== undefined) updates.descripcion = descripcion
  if (peso_libras !== undefined) updates.peso_libras = peso_libras
  // peso_facturable: usar el valor calculado por el frontend (que aplica peso_minimo),
  // o caer a peso_libras si no se envió (compatibilidad hacia atrás)
  if (peso_facturable !== undefined) {
    updates.peso_facturable = peso_facturable
  } else if (peso_libras !== undefined) {
    updates.peso_facturable = peso_libras
  }
  if (tarifa_aplicada !== undefined) updates.tarifa_aplicada = tarifa_aplicada
  if (costo_servicio !== undefined) updates.costo_servicio = costo_servicio
  if (tracking_usaco !== undefined) updates.tracking_usaco = tracking_usaco
  if (notas_cliente !== undefined) updates.notas_cliente = notas_cliente
  // condicion y cantidad afectan el cálculo de tarifa — ahora son editables
  if (condicion !== undefined) updates.condicion = condicion
  if (cantidad !== undefined) updates.cantidad = cantidad
  if (valor_declarado !== undefined) updates.valor_declarado = valor_declarado
  if (caja_id !== undefined) updates.caja_id = caja_id  // null = quitar de caja

  // Marcar timestamp de la actualización
  updates.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('paquetes')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('[admin/paquetes PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Registrar evento de cambio de estado en historial ──────────────────
  const estadoPrevio = estado_anterior ?? paqueteAntes?.estado
  const huboCambioDeEstado = estado && estado !== estadoPrevio
  if (huboCambioDeEstado) {
    await supabaseAdmin.from('eventos_paquete').insert({
      paquete_id: id,
      estado_anterior: estadoPrevio,
      estado_nuevo: estado,
      descripcion: `Estado actualizado por admin: ${estadoPrevio} → ${estado}`,
    }).then(() => {/* ok */}, (e) => console.error('[PATCH] evento:', e))

    // Registro de auditoría: dejar constancia incondicional del intento de notificación
    await supabaseAdmin.from('notificaciones').insert({
      paquete_id: id,
      tipo: 'patch_recibido',
      titulo: `PATCH recibido: ${estadoPrevio} → ${estado}`,
      mensaje: `body.notificar=${notificar} | hubo_cambio=${huboCambioDeEstado} | esperando llamada a notificarCambioEstado`,
      enviada_whatsapp: false,
    }).then(() => {/* ok */}, (e) => console.error('[PATCH] auditoria:', e))
  }

  // ── Disparar notificaciones por WhatsApp ────────────────────────────────
  // IMPORTANTE: siempre intentamos notificar al cambiar algo relevante.
  // El flag `notificar` solo puede deshabilitarlo explícitamente cuando
  // viene === false. Si viene undefined o true, asumimos que SÍ notificar.
  const notificacionesEnviadas: string[] = []
  // Sub-paquetes (visible_cliente=false) nunca notifican al cliente
  const debeNotificar = notificar !== false && paqueteAntes?.visible_cliente !== false

  console.log('[PATCH paquete]', { id, estado, estado_anterior, paqueteAntesEstado: paqueteAntes?.estado, huboCambioDeEstado, debeNotificar })

  if (debeNotificar) {
    // 1) Cambio de estado
    if (huboCambioDeEstado) {
      try {
        await notificarCambioEstado(id, estado)
        notificacionesEnviadas.push('estado')
      } catch (err) {
        console.error('[PATCH] notificarCambioEstado falló:', err)
      }
    }

    // 2) Tracking USACO asignado por primera vez o cambiado
    const trackingCambio =
      tracking_usaco !== undefined &&
      tracking_usaco !== null &&
      String(tracking_usaco).trim() !== '' &&
      tracking_usaco !== paqueteAntes?.tracking_usaco
    if (trackingCambio) {
      try {
        await notificarTrackingActualizado(id)
        notificacionesEnviadas.push('tracking')
      } catch (err) {
        console.error('[PATCH] notificarTrackingActualizado falló:', err)
      }
    }

    // 3) Costo calculado (cuando pasa de null/0 a un valor)
    const costoCambio =
      costo_servicio !== undefined &&
      costo_servicio !== null &&
      Number(costo_servicio) > 0 &&
      Number(costo_servicio) !== Number(paqueteAntes?.costo_servicio ?? 0)
    if (costoCambio) {
      try {
        await notificarCostoCalculado(id)
        notificacionesEnviadas.push('costo')
      } catch (err) {
        console.error('[PATCH] notificarCostoCalculado falló:', err)
      }
    }
  }

  // ── Sub-paquete despachado → propagar estado y notificar via paquete original ──
  const ESTADOS_DESPACHO = ['listo_envio', 'en_transito', 'en_colombia', 'en_bodega_local', 'entregado']
  const esSubPaquete = paqueteAntes?.visible_cliente === false && paqueteAntes?.paquete_origen_id
  if (!debeNotificar && esSubPaquete && huboCambioDeEstado && ESTADOS_DESPACHO.includes(estado)) {
    const origenId = paqueteAntes!.paquete_origen_id as string
    const { data: origen } = await supabaseAdmin
      .from('paquetes')
      .select('id, estado')
      .eq('id', origenId)
      .single()
    if (origen && origen.estado !== estado) {
      await supabaseAdmin.from('paquetes')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', origenId)
      try {
        await notificarCambioEstado(origenId, estado)
        notificacionesEnviadas.push('estado_via_origen')
      } catch (err) {
        console.error('[PATCH] notificar origen desde sub-paquete falló:', err)
      }
    }
  }

  // ── Auto-crear caja USACO y sincronizar estado ───────────────────────────────
  // Se activa cuando el tracking_usaco es asignado o cambiado a un valor numérico nuevo
  const trackingUsacoNuevo =
    tracking_usaco !== undefined &&
    tracking_usaco !== null &&
    String(tracking_usaco).trim() !== '' &&
    String(tracking_usaco).trim() !== String(paqueteAntes?.tracking_usaco ?? '').trim()

  if (trackingUsacoNuevo) {
    const guia = String(tracking_usaco).trim()
    const esNumerico = /^\d+$/.test(guia)

    if (esNumerico) {
      try {
        const ahora = new Date().toISOString()
        const bodegaPaquete = (bodega_destino ?? paqueteAntes?.bodega_destino ?? 'medellin') as string

        // 1. Buscar caja existente con ese tracking_usaco (exacto o sin ceros iniciales)
        const { data: cajas } = await supabaseAdmin
          .from('cajas_consolidacion')
          .select('id, estado_usaco')
          .or(`tracking_usaco.eq.${guia},tracking_usaco.eq.${normGuia(guia)}`)
          .limit(1)
        const cajaExistente = cajas?.[0] ?? null
        let cajaId: string = cajaExistente?.id ?? ''

        // 2. Si no existe, crear una caja despachada para este tracking
        if (!cajaExistente) {
          const { data: nuevaCaja, error: errCaja } = await supabaseAdmin
            .from('cajas_consolidacion')
            .insert({
              tracking_usaco:  guia,
              codigo_interno:  guia,
              estado:          'despachada',
              courier:         'USACO',
              bodega_destino:  bodegaPaquete,
              fecha_despacho:  ahora,
            })
            .select('id')
            .single()

          if (errCaja) {
            console.error('[PATCH usaco] Error creando caja:', errCaja.message)
          } else {
            cajaId = nuevaCaja.id
          }
        }

        // 3. Vincular paquete a la caja (si no estaba ya vinculado)
        if (cajaId && cajaId !== (paqueteAntes?.caja_id as string | null)) {
          await supabaseAdmin
            .from('paquetes')
            .update({ caja_id: cajaId, updated_at: ahora })
            .eq('id', id)
        }

        // 4. Consultar USACO en tiempo real para este tracking
        const resultados = await consultarGuias([guia])
        const estadoUsaco = resultados
          .filter(r => r.estado && !r.estado.toLowerCase().includes('no se encontró'))
          .find(r => normGuia(r.guia) === normGuia(guia))
          ?.estado?.trim() ?? null

        if (estadoUsaco && cajaId) {
          // 5. Actualizar estado_usaco en la caja
          await supabaseAdmin
            .from('cajas_consolidacion')
            .update({ estado_usaco: estadoUsaco, usaco_sync_at: ahora })
            .eq('id', cajaId)

          // 6. Propagar estado al paquete si corresponde (sin retroceder)
          if (!USACO_IGNORAR.has(estadoUsaco)) {
            const estadoPaqNuevo = USACO_A_ESTADO_PAQ[estadoUsaco]
            const eventoTracking = USACO_A_EVENTO_TRACKING[estadoUsaco]

            if (estadoPaqNuevo) {
              // Estado actual del paquete tras el PATCH ya aplicado
              const estadoActual = estado ?? paqueteAntes?.estado ?? 'reportado'
              const ordenActual  = ORDEN_ESTADO[estadoActual] ?? 0
              const ordenNuevo   = ORDEN_ESTADO[estadoPaqNuevo] ?? 0

              if (ordenNuevo > ordenActual) {
                const { error: errPaq } = await supabaseAdmin
                  .from('paquetes')
                  .update({ estado: estadoPaqNuevo, updated_at: ahora })
                  .eq('id', id)

                if (!errPaq) {
                  // Evento interno
                  await supabaseAdmin.from('eventos_paquete').insert({
                    paquete_id:      id,
                    estado_anterior: estadoActual,
                    estado_nuevo:    estadoPaqNuevo,
                    descripcion:     `Actualizado vía USACO (${estadoUsaco}) al asignar tracking ${guia}`,
                    ubicacion: estadoUsaco === 'TransitoInternacional' || estadoUsaco === 'ProcesoDeAduana'
                      ? 'En tránsito' : 'Colombia',
                  }).then(() => null, () => null)

                  // Notificar cambio de estado si corresponde
                  if (paqueteAntes?.visible_cliente !== false) {
                    try { await notificarCambioEstado(id, estadoPaqNuevo) } catch { /* ok */ }
                  }
                }
              }
            }

            // 7. Insertar evento de tracking visible al cliente (si no existe)
            if (eventoTracking) {
              const { data: existe } = await supabaseAdmin
                .from('paquetes_tracking')
                .select('id')
                .eq('paquete_id', id)
                .eq('evento', eventoTracking)
                .maybeSingle()

              if (!existe) {
                await insertarEventoTracking(
                  supabaseAdmin, id, eventoTracking, 'usaco',
                  `${estadoUsaco} — caja ${guia}`,
                )
              }
            }
          }
        }
      } catch (err) {
        // No bloqueamos la respuesta si USACO falla — el tracking ya fue guardado
        console.error('[PATCH usaco] Error en auto-sync:', err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    notificado: notificacionesEnviadas.length > 0,
    notificaciones: notificacionesEnviadas,
  })
}

// ── DELETE: eliminar paquete completo (admin only) ──────────────────────────
export async function DELETE(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('rol, nombre_completo')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Capturar datos del paquete antes de borrar
  const { data: paquete } = await supabaseAdmin
    .from('paquetes')
    .select('tracking_casilla, tracking_origen, descripcion, estado, categoria, tienda, cliente_id, peso_libras, costo_servicio, valor_declarado')
    .eq('id', id)
    .single()

  // Contar divisiones
  const { count: divCount } = await supabaseAdmin
    .from('paquetes')
    .select('id', { count: 'exact', head: true })
    .eq('paquete_origen_id', id)

  // Nombre del cliente si existe
  let clienteNombre: string | null = null
  if (paquete?.cliente_id) {
    const { data: cli } = await supabaseAdmin
      .from('perfiles').select('nombre_completo').eq('id', paquete.cliente_id).single()
    clienteNombre = cli?.nombre_completo ?? null
  }

  // Registrar en log antes de borrar
  if (paquete) {
    await supabaseAdmin.from('paquetes_eliminados').insert({
      paquete_id:          id,
      tracking_casilla:    paquete.tracking_casilla,
      tracking_origen:     paquete.tracking_origen,
      descripcion:         paquete.descripcion,
      estado:              paquete.estado,
      categoria:           paquete.categoria,
      tienda:              paquete.tienda,
      cliente_id:          paquete.cliente_id,
      cliente_nombre:      clienteNombre,
      peso_libras:         paquete.peso_libras,
      costo_servicio:      paquete.costo_servicio,
      valor_declarado:     paquete.valor_declarado,
      cantidad_divisiones: divCount ?? 0,
      eliminado_por:       user.id,
      eliminado_por_nombre: perfil.nombre_completo ?? null,
    }).then(() => {/* ok */}, (e) => console.error('[DELETE] log eliminado:', e))
  }

  // Borrar notificaciones (no tienen CASCADE) — fotos_paquetes y eventos_paquete sí
  await supabaseAdmin.from('notificaciones').delete().eq('paquete_id', id)

  const { error } = await supabaseAdmin
    .from('paquetes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[admin/paquetes DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
