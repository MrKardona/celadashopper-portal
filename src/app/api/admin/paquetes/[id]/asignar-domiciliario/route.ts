// POST /api/admin/paquetes/[id]/asignar-domiciliario
// Asigna un domiciliario a un paquete y lo pone en_camino_cliente
// DELETE /api/admin/paquetes/[id]/asignar-domiciliario
// Desasigna el domiciliario (vuelve a en_bodega_local)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return user
}

interface Props { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: paqueteId } = await params
  const body = await req.json() as { domiciliario_id: string }

  if (!body.domiciliario_id) {
    return NextResponse.json({ error: 'domiciliario_id requerido' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verificar que el domiciliario existe y tiene el rol correcto
  const { data: domiciliario } = await admin
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .eq('id', body.domiciliario_id)
    .eq('rol', 'domiciliario')
    .maybeSingle()

  if (!domiciliario) {
    return NextResponse.json({ error: 'Domiciliario no encontrado' }, { status: 404 })
  }

  // Verificar que el paquete existe y está en bodega local
  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado, descripcion, tracking_casilla')
    .eq('id', paqueteId)
    .maybeSingle()

  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  if (!['en_bodega_local', 'en_camino_cliente'].includes(paquete.estado)) {
    return NextResponse.json({
      error: `El paquete está en estado "${paquete.estado}". Solo se pueden asignar paquetes en bodega local o en camino.`,
    }, { status: 400 })
  }

  const ahora = new Date().toISOString()
  const { error } = await admin
    .from('paquetes')
    .update({
      domiciliario_id: body.domiciliario_id,
      fecha_asignacion_domiciliario: ahora,
      estado: 'en_camino_cliente',
      updated_at: ahora,
    })
    .eq('id', paqueteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('eventos_paquete').insert({
    paquete_id: paqueteId,
    estado_anterior: paquete.estado,
    estado_nuevo: 'en_camino_cliente',
    descripcion: `Asignado a domiciliario: ${domiciliario.nombre_completo}`,
    ubicacion: 'Colombia',
  }).then(() => {}, (e) => console.error('[asignar-domiciliario] evento:', e))

  return NextResponse.json({ ok: true, domiciliario: domiciliario.nombre_completo })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: paqueteId } = await params
  const admin = getSupabaseAdmin()

  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado')
    .eq('id', paqueteId)
    .maybeSingle()

  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

  const ahora = new Date().toISOString()
  const { error } = await admin
    .from('paquetes')
    .update({
      domiciliario_id: null,
      fecha_asignacion_domiciliario: null,
      estado: 'en_bodega_local',
      updated_at: ahora,
    })
    .eq('id', paqueteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('eventos_paquete').insert({
    paquete_id: paqueteId,
    estado_anterior: paquete.estado,
    estado_nuevo: 'en_bodega_local',
    descripcion: 'Domiciliario desasignado — regresado a bodega local',
    ubicacion: 'Colombia',
  }).then(() => {}, (e) => console.error('[desasignar-domiciliario] evento:', e))

  return NextResponse.json({ ok: true })
}
