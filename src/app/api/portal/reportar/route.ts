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

async function enviarWhatsapp(phone: string, texto: string): Promise<void> {
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const token = process.env.META_ACCESS_TOKEN
  if (!phoneId || !token) return

  const numeroLimpio = phone.replace(/\D/g, '')
  const numero = numeroLimpio.startsWith('57') ? numeroLimpio : `57${numeroLimpio}`

  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: texto },
    }),
  })
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

  // ── Buscar paquete sin asignar con mismo tracking_origen ──────────────────
  const trackingOrigen = body.tracking_origen?.trim() || null
  let matchId: string | null = null
  let matchTracking: string | null = null
  let matchDescripcion: string | null = null

  if (trackingOrigen) {
    const { data: sinAsignar } = await admin
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, peso_libras')
      .is('cliente_id', null)
      .ilike('tracking_origen', trackingOrigen)
      .limit(1)
      .single()

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

    // Notificar por WhatsApp
    if (phoneCliente) {
      const msg =
        `¡Hola ${nombreCorto}! 🎉\n\n` +
        `Tenemos una buena noticia: *tu paquete ya está en nuestra bodega de Miami* y lo acabamos de asociar a tu cuenta.\n\n` +
        `📦 *${body.descripcion}*\n` +
        `🔖 Tracking CeladaShopper: *${matchTracking}*\n\n` +
        `Lo despacharemos pronto a Colombia. Te avisamos cuando esté en camino. ✈️`

      enviarWhatsapp(phoneCliente, msg).catch(() => {/* best-effort */})
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

  return NextResponse.json({ ok: true, match: false, tracking_casilla: nuevo.tracking_casilla })
}
