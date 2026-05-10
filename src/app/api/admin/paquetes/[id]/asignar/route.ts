// POST /api/admin/paquetes/[id]/asignar
// Admin asigna manualmente un paquete a un cliente.
// Notifica por WhatsApp (mensaje personalizado) + Email (plantilla recibido_usa).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmailPorEstado } from '@/lib/email/notificaciones'

function getSupabaseAdmin() {
  return createClient(
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

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params

  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfilAdmin } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfilAdmin || perfilAdmin.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { cliente_id?: string; notificar?: boolean; bodega_destino?: string }
  const clienteId = body.cliente_id?.trim()
  const debeNotificar = body.notificar !== false
  const bodegaAutoAsignada = body.bodega_destino

  if (!clienteId) {
    return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  }

  // Validar que el cliente existe
  const { data: cliente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, whatsapp, telefono, numero_casilla, rol')
    .eq('id', clienteId)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Cargar paquete actual (campos completos para el email)
  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, descripcion, cliente_id, estado, tienda, peso_libras, costo_servicio, bodega_destino, tracking_usaco, valor_declarado')
    .eq('id', id)
    .maybeSingle()

  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  const eraReasignacion = paquete.cliente_id !== null && paquete.cliente_id !== clienteId

  // Actualizar paquete — incluir bodega_destino si viene calculada
  const updatePayload: Record<string, unknown> = {
    cliente_id: clienteId,
    updated_at: new Date().toISOString(),
  }
  if (bodegaAutoAsignada && ['medellin', 'bogota', 'barranquilla'].includes(bodegaAutoAsignada)) {
    updatePayload.bodega_destino = bodegaAutoAsignada
  }
  const { error: updateErr } = await admin
    .from('paquetes')
    .update(updatePayload)
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Registrar evento
  await admin.from('eventos_paquete').insert({
    paquete_id: id,
    estado_anterior: paquete.estado,
    estado_nuevo: paquete.estado,
    descripcion: eraReasignacion
      ? `Reasignado manualmente al cliente ${cliente.nombre_completo}`
      : `Asignado manualmente al cliente ${cliente.nombre_completo}`,
  }).then(() => {/* ok */}, (e) => console.error('[asignar] evento:', e))

  // Notificar WhatsApp al cliente
  let envioOk = false
  let envioError: string | undefined
  const phoneCliente = cliente.whatsapp ?? cliente.telefono

  if (debeNotificar && phoneCliente) {
    const nombreCorto = cliente.nombre_completo?.split(' ')[0] ?? 'Cliente'
    const linkSeguimiento = `https://portal.celadashopper.com/paquetes/${id}`
    const texto =
      `¡Hola ${nombreCorto}! 🎉\n\n` +
      `*Tu paquete ya está en nuestra bodega de Miami* y lo acabamos de asociar a tu cuenta.\n\n` +
      `📦 *${paquete.descripcion}*\n` +
      `🔖 Tu número CeladaShopper: *${paquete.tracking_casilla}*\n` +
      (cliente.numero_casilla ? `📬 Casilla: ${cliente.numero_casilla}\n` : '') +
      `\n👉 Sigue tu paquete aquí:\n${linkSeguimiento}\n\n` +
      `Lo despacharemos pronto a Colombia. ✈️`

    const r = await enviarWhatsappTexto(phoneCliente, texto)
    envioOk = r.ok
    envioError = r.error

    await admin.from('notificaciones').insert({
      cliente_id: clienteId,
      paquete_id: id,
      tipo: 'paquete_asignado_manual',
      titulo: `Paquete asignado por admin a ${cliente.nombre_completo}`,
      mensaje: envioOk ? texto : `${texto}\n\n[ERROR DE ENVÍO]: ${envioError ?? 'desconocido'}`,
      enviada_whatsapp: envioOk,
    }).then(() => {/* ok */}, () => {/* swallow */})
  }

  // ── Email al cliente ────────────────────────────────────────────────────────
  let emailEnviado = false
  let emailError: string | undefined
  if (debeNotificar && cliente.email) {
    try {
      const resultado = await enviarEmailPorEstado(paquete.estado ?? 'recibido_usa', {
        emailDestino: cliente.email,
        nombre: cliente.nombre_completo ?? 'Cliente',
        paqueteId: id,
        tracking: paquete.tracking_casilla ?? id,
        descripcion: paquete.descripcion ?? '—',
        tienda: paquete.tienda,
        peso_libras: paquete.peso_libras,
        costo_servicio: paquete.costo_servicio,
        bodega_destino: paquete.bodega_destino,
        tracking_usaco: paquete.tracking_usaco,
        valor_declarado: paquete.valor_declarado,
      })
      emailEnviado = resultado.ok ?? false
      if (!emailEnviado) emailError = resultado.error ?? 'Error desconocido'
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Error al enviar email'
      console.error('[asignar] email:', emailError)
    }
  }

  return NextResponse.json({
    ok: true,
    cliente: { nombre: cliente.nombre_completo, casilla: cliente.numero_casilla },
    notificacion: {
      intentada: debeNotificar && (!!phoneCliente || !!cliente.email),
      enviada: envioOk,
      error: envioError,
      sin_telefono: debeNotificar && !phoneCliente,
      email_enviado: emailEnviado,
      email_error: emailError,
      sin_email: debeNotificar && !cliente.email,
    },
  })
}
