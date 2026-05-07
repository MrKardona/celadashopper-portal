// PATCH /api/admin/paquetes/[id]
// Actualiza datos del paquete y dispara notificación WhatsApp si el estado cambia

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  notificarCambioEstado,
  notificarTrackingActualizado,
  notificarCostoCalculado,
} from '@/lib/notificaciones/por-estado'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
    estado, bodega_destino, peso_libras, peso_facturable, tarifa_aplicada,
    costo_servicio, tracking_usaco, notas_cliente, condicion, cantidad,
    notificar, estado_anterior,
  } = body

  // Estado actual del paquete antes del update (para detectar cambios reales)
  const { data: paqueteAntes } = await supabaseAdmin
    .from('paquetes')
    .select('estado, tracking_usaco, costo_servicio')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = {}
  if (estado !== undefined) updates.estado = estado
  if (bodega_destino !== undefined) updates.bodega_destino = bodega_destino
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
  const debeNotificar = notificar !== false

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
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
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
