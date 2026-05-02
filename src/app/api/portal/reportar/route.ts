// src/app/api/portal/reportar/route.ts
// POST /api/portal/reportar
// Registra un paquete nuevo. Si existe un paquete sin asignar con el mismo
// tracking_origen, hace match automático y notifica al cliente por WhatsApp.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function enviarWhatsappTexto(phone: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) return { ok: false, error: 'META_WA_PHONE_ID/TOKEN no configurados' }

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: dest,
        type: 'text',
        text: { body: texto },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Meta ${res.status}: ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function enviarWhatsappImagen(phone: string, imageUrl: string, caption: string): Promise<{ ok: boolean; error?: string }> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) return { ok: false, error: 'META_WA_PHONE_ID/TOKEN no configurados' }

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: dest,
        type: 'image',
        image: { link: imageUrl, caption },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Meta ${res.status}: ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    tienda: string
    tracking_origen?: string
    descripcion: string
    categoria: string
    valor_declarado?: number | null
    fecha_compra?: string | null
    fecha_estimada_llegada?: string | null
    bodega_destino: string
    notas_cliente?: string | null
  }

  const admin = getSupabaseAdmin()

  // ── Obtener perfil del cliente (nombre + whatsapp) ────────────────────────
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre_completo, whatsapp, telefono')
    .eq('id', user.id)
    .single()

  const nombreCorto = perfil?.nombre_completo?.split(' ')[0] ?? 'cliente'
  const phoneCliente = perfil?.whatsapp ?? perfil?.telefono ?? null

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
        valor_declarado: body.valor_declarado ?? null,
        fecha_compra: body.fecha_compra ?? null,
        fecha_estimada_llegada: body.fecha_estimada_llegada ?? null,
        bodega_destino: body.bodega_destino,
        notas_cliente: body.notas_cliente ?? null,
        tracking_origen: trackingOrigen,
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

    // Notificar por WhatsApp (texto + foto si existe)
    if (phoneCliente) {
      // Buscar foto del paquete
      const { data: fotos } = await admin
        .from('fotos_paquetes')
        .select('url')
        .eq('paquete_id', matchId)
        .order('created_at', { ascending: true })
        .limit(1)

      const fotoUrl = fotos?.[0]?.url ?? null

      const linkSeguimiento = `https://portal.celadashopper.com/paquetes/${matchId}`

      const captionOTexto =
        `¡Hola ${nombreCorto}! 🎉\n\n` +
        `*Tu paquete ya está en nuestra bodega de Miami* y lo acabamos de asociar a tu cuenta.\n\n` +
        `📦 *${body.descripcion}*\n` +
        (trackingOrigen ? `🚚 Tracking courier: *${trackingOrigen}*\n` : '') +
        `🔖 Tu número CeladaShopper: *${matchTracking}*\n\n` +
        `👉 Sigue tu paquete aquí:\n${linkSeguimiento}\n\n` +
        `Lo despacharemos pronto a Colombia. ✈️`

      let envioOk = false
      let envioError: string | undefined
      let envioMetodo = 'texto'

      if (fotoUrl) {
        // Intentar imagen primero
        envioMetodo = 'imagen'
        const r = await enviarWhatsappImagen(phoneCliente, fotoUrl, captionOTexto)
        envioOk = r.ok
        envioError = r.error
        // Si falla la imagen, fallback a texto
        if (!envioOk) {
          console.warn('[match] Imagen falló, fallback a texto:', r.error)
          envioMetodo = 'texto_fallback'
          const t = await enviarWhatsappTexto(phoneCliente, captionOTexto)
          envioOk = t.ok
          envioError = t.error ?? envioError
        }
      } else {
        const t = await enviarWhatsappTexto(phoneCliente, captionOTexto)
        envioOk = t.ok
        envioError = t.error
      }

      // Registrar la notificación de match
      await admin.from('notificaciones').insert({
        cliente_id: user.id,
        paquete_id: matchId,
        tipo: 'paquete_match',
        titulo: `Paquete asignado por match (${envioMetodo})`,
        mensaje: envioOk
          ? captionOTexto
          : `${captionOTexto}\n\n[ERROR DE ENVÍO]: ${envioError ?? 'desconocido'}`,
        enviada_whatsapp: envioOk,
      }).then(() => {/* ok */}, () => {/* swallow */})
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
      valor_declarado: body.valor_declarado ?? null,
      fecha_compra: body.fecha_compra ?? null,
      fecha_estimada_llegada: body.fecha_estimada_llegada ?? null,
      bodega_destino: body.bodega_destino,
      notas_cliente: body.notas_cliente ?? null,
    })
    .select('tracking_casilla')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── Enviar WhatsApp de confirmación al cliente (best-effort, no bloquea) ──
  let whatsappEnviado = false
  if (phoneCliente) {
    const linkSeguimiento = `https://portal.celadashopper.com/paquetes`
    const textoConfirmacion =
      `¡Hola ${nombreCorto}! 👋\n\n` +
      `*Recibimos tu pedido en CeladaShopper* ✅\n\n` +
      `📦 *${body.descripcion}*\n` +
      `🏬 ${body.tienda}\n` +
      (trackingOrigen ? `🚚 Tracking del courier: *${trackingOrigen}*\n` : '') +
      `🔖 Tu número CeladaShopper: *${nuevo.tracking_casilla}*\n\n` +
      `Te avisaremos por WhatsApp cuando tu paquete:\n` +
      `• Llegue a nuestra bodega de Miami 📍\n` +
      `• Esté en camino a Colombia ✈️\n` +
      `• Esté listo para recoger 🎉\n\n` +
      `👉 Sigue tus paquetes aquí:\n${linkSeguimiento}`

    let envioError: string | undefined
    try {
      const r = await enviarWhatsappTexto(phoneCliente, textoConfirmacion)
      whatsappEnviado = r.ok
      envioError = r.error
      if (!r.ok) console.error('[reportar] Envío falló:', r.error)
    } catch (err) {
      console.error('[reportar] Error enviando WhatsApp de confirmación:', err)
      envioError = err instanceof Error ? err.message : String(err)
    }

    // Registrar SIEMPRE la notificación (ok o fallido) para diagnóstico
    await admin.from('notificaciones').insert({
      cliente_id: user.id,
      tipo: 'paquete_reportado',
      titulo: `Pedido reportado: ${nuevo.tracking_casilla}`,
      mensaje: whatsappEnviado
        ? textoConfirmacion
        : `${textoConfirmacion}\n\n[ERROR DE ENVÍO]: ${envioError ?? 'desconocido'}`,
      enviada_whatsapp: whatsappEnviado,
    }).then(() => {/* ok */}, () => {/* swallow */})
  }

  return NextResponse.json({
    ok: true,
    match: false,
    tracking_casilla: nuevo.tracking_casilla,
    whatsapp_enviado: whatsappEnviado,
  })
}
