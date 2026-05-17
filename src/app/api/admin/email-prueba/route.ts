// POST /api/admin/email-prueba — envía un email de prueba para verificar SMTP

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { enviarEmailPrueba } from '@/lib/email/notificaciones'

export async function POST(req: NextRequest) {
  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol, nombre_completo')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { email?: string; nombre?: string }
  const email = body.email?.trim()
  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
  }

  const r = await enviarEmailPrueba(email, body.nombre ?? perfil.nombre_completo ?? 'amigo')

  return NextResponse.json({
    ok: r.ok,
    message_id: r.messageId,
    error: r.error,
    diagnostico: r.ok
      ? `Email enviado correctamente a ${email}. Revisa la bandeja de entrada (y spam por las dudas).`
      : `Falló el envío: ${r.error ?? 'error desconocido'}. Verifica las variables SMTP_* en Vercel.`,
  })
}
