import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = getAdmin()

  // Verificar que existe y tiene rol domiciliario
  const { data: perfil } = await admin
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .eq('id', id)
    .eq('rol', 'domiciliario')
    .single()

  if (!perfil) {
    return NextResponse.json({ error: 'Domiciliario no encontrado' }, { status: 404 })
  }

  // Desasignar paquetes pendientes que tenga asignados
  await admin
    .from('paquetes')
    .update({ domiciliario_id: null, orden_ruta: null })
    .eq('domiciliario_id', id)
    .in('estado', ['en_camino_cliente', 'en_bodega_local', 'listo_entrega'])

  // Desasignar domicilios manuales pendientes
  await admin
    .from('domicilios_manuales')
    .update({ domiciliario_id: null })
    .eq('domiciliario_id', id)
    .eq('estado', 'pendiente')

  // Cambiar rol a 'cliente' y desactivar
  const { error } = await admin
    .from('perfiles')
    .update({ rol: 'cliente', activo: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
