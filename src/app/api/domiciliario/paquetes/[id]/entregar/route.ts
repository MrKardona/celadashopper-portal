// POST /api/domiciliario/paquetes/[id]/entregar
// El domiciliario marca un paquete como entregado

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol, nombre_completo')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'domiciliario') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: paqueteId } = await params
  const body = await req.json() as { foto_url?: string | null; notas?: string | null; notificar?: boolean }

  // Verificar que el paquete está asignado a este domiciliario
  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado, cliente_id, descripcion, tracking_casilla')
    .eq('id', paqueteId)
    .eq('domiciliario_id', user.id)
    .maybeSingle()

  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado o no asignado a ti' }, { status: 404 })
  }

  if (paquete.estado === 'entregado') {
    return NextResponse.json({ ok: true, mensaje: 'Ya estaba marcado como entregado' })
  }

  const ahora = new Date().toISOString()

  const { error: updErr } = await admin
    .from('paquetes')
    .update({
      estado: 'entregado',
      updated_at: ahora,
    })
    .eq('id', paqueteId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Guardar foto de entrega si viene
  if (body.foto_url) {
    await admin.from('fotos_paquetes').insert({
      paquete_id: paqueteId,
      url: body.foto_url,
      descripcion: 'Foto de entrega',
      created_at: ahora,
    }).then(() => {}, (e) => console.error('[domiciliario/entregar] foto:', e))
  }

  await admin.from('eventos_paquete').insert({
    paquete_id: paqueteId,
    estado_anterior: paquete.estado,
    estado_nuevo: 'entregado',
    descripcion: body.notas
      ? `Entregado por domiciliario ${perfil.nombre_completo}. ${body.notas}`
      : `Entregado por domiciliario ${perfil.nombre_completo}`,
    ubicacion: 'Colombia',
  }).then(() => {}, (e) => console.error('[domiciliario/entregar] evento:', e))

  // Notificar al cliente
  if (body.notificar !== false && paquete.cliente_id) {
    try {
      await notificarCambioEstado(paqueteId, 'entregado')
    } catch (err) {
      console.error('[domiciliario/entregar] notif:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
