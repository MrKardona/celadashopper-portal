// POST /api/admin/paquetes/[id]/entregar
// Marca un paquete como ENTREGADO. Permite adjuntar foto opcional de la
// entrega. Dispara notificación email + WhatsApp con la foto al cliente.
// Esto cierra el flujo del paquete.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return user
}

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    foto_url?: string | null
    notas?: string | null
    notificar?: boolean
  }

  const admin = getSupabaseAdmin()

  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado, tracking_casilla, cliente_id')
    .eq('id', id)
    .maybeSingle()

  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  if (paquete.estado === 'entregado') {
    return NextResponse.json({
      error: 'paquete_ya_entregado',
      mensaje: 'Este paquete ya fue entregado anteriormente.',
    }, { status: 409 })
  }

  // Cambiar estado a entregado
  const ahora = new Date().toISOString()
  const { error: updateErr } = await admin
    .from('paquetes')
    .update({
      estado: 'entregado',
      fecha_entrega: ahora,
      updated_at: ahora,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[entregar] update:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Guardar foto de la entrega si llega
  if (body.foto_url) {
    await admin.from('fotos_paquetes').insert({
      paquete_id: id,
      url: body.foto_url,
      storage_path: body.foto_url,
      descripcion: 'Foto de entrega al cliente',
      subida_por: user.id,
    }).then(() => {/* ok */}, e => console.error('[entregar] foto:', e))
  }

  // Registrar evento
  await admin.from('eventos_paquete').insert({
    paquete_id: id,
    estado_anterior: paquete.estado,
    estado_nuevo: 'entregado',
    descripcion: body.notas?.trim() || 'Paquete entregado al cliente',
    ubicacion: 'Colombia',
    agente_id: user.id,
  })

  // Notificar (email + WhatsApp). Solo si el paquete tiene cliente y no se
  // pidió explícitamente no notificar.
  const debeNotificar = body.notificar !== false
  if (debeNotificar && paquete.cliente_id) {
    try {
      await notificarCambioEstado(id, 'entregado')
    } catch (err) {
      console.error('[entregar] notificación:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    notificado: debeNotificar && !!paquete.cliente_id,
  })
}
