// POST /api/admin/whatsapp-prueba — envía un mensaje de prueba al teléfono
// indicado para verificar la configuración de Meta + Kommo. Admin only.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function enviarMetaDirecto(phone: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const phoneId = process.env.META_PHONE_NUMBER_ID
  const token = process.env.META_ACCESS_TOKEN
  if (!phoneId || !token) {
    return { ok: false, error: 'META_PHONE_NUMBER_ID o META_ACCESS_TOKEN no configurados' }
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

  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `Meta ${res.status}: ${body.slice(0, 200)}` }
  }
  return { ok: true }
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

  try {
    if (via === 'meta') {
      const r = await enviarMetaDirecto(telefono, mensaje)
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
      return NextResponse.json({ ok: true, via: 'meta', metodo: 'directo' })
    }

    const r = await sendProactiveWhatsApp(telefono, mensaje)
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
