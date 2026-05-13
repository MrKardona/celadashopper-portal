// POST /api/admin/whatsapp-prueba — envía un mensaje de prueba al teléfono
// indicado para verificar la configuración de Meta + Kommo. Admin only.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'

async function enviarMetaDirecto(phone: string, texto: string): Promise<{ ok: boolean; error?: string; messageId?: string; responseRaw?: string; destino?: string }> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    return { ok: false, error: 'META_WA_PHONE_ID o META_WA_TOKEN no configurados en Vercel' }
  }

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`

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

  const responseRaw = await res.text()

  if (!res.ok) {
    return { ok: false, error: `Meta ${res.status}: ${responseRaw.slice(0, 400)}`, responseRaw, destino: dest }
  }

  // Extraer message_id si vino
  let messageId: string | undefined
  try {
    const data = JSON.parse(responseRaw) as { messages?: { id?: string }[] }
    messageId = data.messages?.[0]?.id
  } catch { /* ignorar */ }

  return { ok: true, messageId, responseRaw, destino: dest }
}

export async function POST(req: NextRequest) {
  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { telefono?: string; via?: 'kommo' | 'meta' }
  const telefono = body.telefono?.trim()
  const via = body.via ?? 'kommo'

  if (!telefono) {
    return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
  }

  const mensaje = `🧪 Prueba de WhatsApp desde CeladaShopper\n\nSi recibes este mensaje, las notificaciones están funcionando correctamente vía ${via === 'meta' ? 'Meta directo' : 'Kommo'}.\n\n— Equipo CeladaShopper`

  // Buscar cliente por teléfono para registro de auditoría
  const numeroLimpio = telefono.replace(/\D/g, '')
  let clienteIdAudit: string | null = null
  let clienteNombre: string | null = null
  try {
    const { data: posibles } = await admin
      .from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono')
      .or(`whatsapp.ilike.%${numeroLimpio}%,telefono.ilike.%${numeroLimpio}%`)
      .limit(1)
    if (posibles && posibles.length > 0) {
      clienteIdAudit = posibles[0].id
      clienteNombre = posibles[0].nombre_completo
    }
  } catch { /* ignorar */ }

  try {
    if (via === 'meta') {
      const r = await enviarMetaDirecto(telefono, mensaje)

      // Registrar SIEMPRE en notificaciones (audit + diagnóstico)
      await admin.from('notificaciones').insert({
        cliente_id: clienteIdAudit,
        tipo: 'prueba_whatsapp',
        titulo: r.ok
          ? `[PRUEBA] ${clienteNombre ?? telefono} (Meta directo) ✓ message_id=${r.messageId ?? 'sin_id'}`
          : `[PRUEBA] ${clienteNombre ?? telefono} (Meta directo) FALLÓ`,
        mensaje: r.ok
          ? `Destino normalizado: ${r.destino}\nMessage ID: ${r.messageId}\nRespuesta: ${r.responseRaw?.slice(0, 500)}`
          : `Destino normalizado: ${r.destino}\nError: ${r.error}\nRespuesta: ${r.responseRaw?.slice(0, 500)}`,
        enviada_whatsapp: r.ok,
      }).then(() => {/* ok */}, () => {/* swallow */})

      if (!r.ok) {
        return NextResponse.json({
          error: r.error,
          destino: r.destino,
          response_raw: r.responseRaw?.slice(0, 500),
        }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        via: 'meta',
        metodo: 'directo',
        destino: r.destino,
        message_id: r.messageId,
        diagnostico: r.messageId
          ? `Meta aceptó el mensaje con id ${r.messageId}. Si el cliente no lo recibe, verifica: (1) que el número ${r.destino} sea WhatsApp activo, (2) que el cliente no haya bloqueado el número del negocio, (3) ventana 24h: si nunca te ha escrito, WhatsApp puede limitar mensajes free-form.`
          : 'Meta retornó OK pero sin message_id. Revisa logs.',
      })
    }

    const r = await sendProactiveWhatsApp(telefono, mensaje)

    // Registrar Kommo también
    await admin.from('notificaciones').insert({
      cliente_id: clienteIdAudit,
      tipo: 'prueba_whatsapp',
      titulo: `[PRUEBA] ${clienteNombre ?? telefono} (Kommo ${r.metodo})`,
      mensaje: `Vía Kommo, método=${r.metodo}, enviado=${r.enviado}`,
      enviada_whatsapp: r.enviado,
    }).then(() => {/* ok */}, () => {/* swallow */})

    return NextResponse.json({
      ok: r.enviado,
      via: 'kommo',
      metodo: r.metodo,
      mensaje: r.metodo === 'sin_contacto'
        ? 'No se encontró el contacto en Kommo. El cliente debe escribir primero al WhatsApp del negocio.'
        : r.metodo === 'tarea'
          ? 'No hay chat activo en Kommo. Se creó una tarea para que el equipo escriba manualmente.'
          : 'Mensaje enviado por chat existente en Kommo.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
