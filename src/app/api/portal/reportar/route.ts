// src/app/api/portal/reportar/route.ts
// POST /api/portal/reportar
// Registra un paquete nuevo. Si existe un paquete sin asignar con el mismo
// tracking_origen, hace match automático y notifica al cliente por WhatsApp.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { enviarEmailPedidoReportado } from '@/lib/email/notificaciones'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    tienda: string
    tracking_origen?: string
    descripcion: string
    categoria: string
    condicion?: 'nuevo' | 'usado' | null
    cantidad?: number | null
    valor_declarado?: number | null
    fecha_compra?: string | null
    fecha_estimada_llegada?: string | null
    bodega_destino: string
    notas_cliente?: string | null
    direccion_entrega?: string | null
    barrio_entrega?: string | null
    referencia_entrega?: string | null
    requiere_consolidacion?: boolean
    notas_consolidacion?: string | null
  }

  const admin = getSupabaseAdmin()

  // ── Obtener perfil del cliente (nombre + whatsapp) ────────────────────────
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre_completo, email')
    .eq('id', user.id)
    .single()

  const nombreCorto = perfil?.nombre_completo?.split(' ')[0] ?? 'cliente'

  // ── Verificar duplicados y buscar match con sin_asignar ───────────────────
  const trackingOrigen = body.tracking_origen?.trim() || null
  let matchId: string | null = null
  let matchTracking: string | null = null
  let matchDescripcion: string | null = null

  if (trackingOrigen) {
    // 1. ¿Este cliente ya registró este mismo tracking?
    const { data: duplicadoPropio } = await admin
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, estado')
      .ilike('tracking_origen', trackingOrigen)
      .eq('cliente_id', user.id)
      .limit(1)
      .maybeSingle()

    if (duplicadoPropio) {
      return NextResponse.json({
        error: 'duplicate_own',
        tracking_casilla: duplicadoPropio.tracking_casilla,
        descripcion: duplicadoPropio.descripcion,
        estado: duplicadoPropio.estado,
      }, { status: 409 })
    }

    // 2. ¿Otro cliente ya tiene este tracking asignado?
    const { data: duplicadoOtro } = await admin
      .from('paquetes')
      .select('id')
      .ilike('tracking_origen', trackingOrigen)
      .not('cliente_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (duplicadoOtro) {
      return NextResponse.json({
        error: 'duplicate_other',
      }, { status: 409 })
    }

    // 3. ¿Existe sin asignar? → hacer match automático
    const { data: sinAsignar } = await admin
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, peso_libras')
      .is('cliente_id', null)
      .ilike('tracking_origen', trackingOrigen)
      .limit(1)
      .maybeSingle()

    if (sinAsignar) {
      matchId = sinAsignar.id
      matchTracking = sinAsignar.tracking_casilla
      matchDescripcion = sinAsignar.descripcion
    }
  }

  if (matchId) {
    // ── MATCH: actualizar paquete existente con el cliente ────────────────
    const { error: updateErr } = await admin
      .from('paquetes')
      .update({
        cliente_id: user.id,
        // Enriquecer con datos del cliente si faltan
        tienda: body.tienda,
        descripcion: body.descripcion,
        categoria: body.categoria,
        condicion: body.condicion ?? null,
        cantidad: body.cantidad && body.cantidad > 0 ? body.cantidad : 1,
        valor_declarado: body.valor_declarado ?? null,
        fecha_compra: body.fecha_compra ?? null,
        fecha_estimada_llegada: body.fecha_estimada_llegada ?? null,
        bodega_destino: body.bodega_destino,
        notas_cliente: body.notas_cliente ?? null,
        tracking_origen: trackingOrigen,
        direccion_entrega: body.direccion_entrega?.trim() || null,
        barrio_entrega: body.barrio_entrega?.trim() || null,
        referencia_entrega: body.referencia_entrega?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Registrar evento
    await admin.from('eventos_paquete').insert({
      paquete_id: matchId,
      estado_anterior: 'recibido_usa',
      estado_nuevo: 'recibido_usa',
      descripcion: `Paquete asignado al cliente ${nombreCorto} por match de tracking`,
      ubicacion: 'Miami, USA',
    })

    // Notificar al cliente via template Meta aprobado + email
    // notificarCambioEstado centraliza: WA template cs_paquete_recibido_usa + foto + email
    try {
      await notificarCambioEstado(matchId, 'recibido_usa')
    } catch (err) {
      console.error('[reportar match] notificarCambioEstado:', err)
    }

    return NextResponse.json({
      ok: true,
      match: true,
      tracking_casilla: matchTracking,
      descripcion_match: matchDescripcion,
    })
  }

  // ── NO MATCH: crear paquete nuevo normalmente ─────────────────────────────
  const { data: nuevo, error: insertErr } = await admin
    .from('paquetes')
    .insert({
      cliente_id: user.id,
      tienda: body.tienda,
      tracking_origen: trackingOrigen,
      descripcion: body.descripcion,
      categoria: body.categoria,
      condicion: body.condicion ?? null,
      cantidad: body.cantidad && body.cantidad > 0 ? body.cantidad : 1,
      valor_declarado: body.valor_declarado ?? null,
      fecha_compra: body.fecha_compra ?? null,
      fecha_estimada_llegada: body.fecha_estimada_llegada ?? null,
      bodega_destino: body.bodega_destino,
      notas_cliente: body.notas_cliente ?? null,
      direccion_entrega: body.direccion_entrega?.trim() || null,
      barrio_entrega: body.barrio_entrega?.trim() || null,
      referencia_entrega: body.referencia_entrega?.trim() || null,
      requiere_consolidacion: body.requiere_consolidacion ?? false,
      notas_consolidacion: body.notas_consolidacion?.trim() || null,
    })
    .select('id, tracking_casilla')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── Enviar EMAIL (canal principal, siempre que haya email del cliente) ──
  // WhatsApp: no hay template Meta aprobado para "paquete reportado", se notifica por WA
  // cuando el paquete llegue a bodega (recibido_usa) a través de notificarCambioEstado
  let emailOk = false
  let emailMsgId: string | undefined
  let emailErr: string | undefined
  if (perfil?.email) {
    try {
      const r = await enviarEmailPedidoReportado({
        emailDestino: perfil.email,
        nombre: nombreCorto,
        paqueteId: nuevo.id ?? '',
        tracking: nuevo.tracking_casilla ?? '',
        descripcion: body.descripcion,
        tracking_origen: trackingOrigen,
        bodega_destino: body.bodega_destino,
        tienda: body.tienda,
        categoria: body.categoria,
        valor_declarado: body.valor_declarado ?? null,
        fecha_compra: body.fecha_compra ?? null,
        fecha_estimada_llegada: body.fecha_estimada_llegada ?? null,
        notas_cliente: body.notas_cliente ?? null,
      })
      emailOk = r.ok
      emailMsgId = r.messageId
      emailErr = r.error
      if (!r.ok) console.error('[reportar] Email falló:', r.error)
    } catch (err) {
      console.error('[reportar] Error enviando email:', err)
      emailErr = err instanceof Error ? err.message : String(err)
    }
  }

  // ── Registrar notificación con auditoría limpia en columnas ──
  await admin.from('notificaciones').insert({
    cliente_id: user.id,
    paquete_id: nuevo.id,
    tipo: 'paquete_reportado',
    titulo: `Pedido reportado: ${nuevo.tracking_casilla}`,
    mensaje: `Paquete reportado por el cliente. Bodega: ${body.bodega_destino}. Tracking courier: ${trackingOrigen ?? 'no informado'}.`,
    enviada_whatsapp: false,
    enviada_email: emailOk,
    email_message_id: emailMsgId ?? null,
    email_error: emailErr ?? null,
    email_destino: perfil?.email ?? null,
  }).then(() => {/* ok */}, (e) => console.error('[reportar] log notificacion:', e))

  return NextResponse.json({
    ok: true,
    match: false,
    tracking_casilla: nuevo.tracking_casilla,
    whatsapp_enviado: false,
  })
}
