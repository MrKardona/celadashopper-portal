// POST /api/admin/paquetes/[id]/asignar
// Admin asigna manualmente un paquete a un cliente.
// Notifica vía notificarCambioEstado('recibido_usa'):
//   → template Meta aprobado + foto del contenido + email

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
    .select('id, tracking_casilla, tracking_origen, descripcion, cliente_id, estado, tienda, peso_libras, costo_servicio, bodega_destino, tracking_usaco, valor_declarado')
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

  // Notificar al cliente: template Meta aprobado + foto del contenido + email
  // notificarCambioEstado('recibido_usa') centraliza toda la lógica de notificación
  if (debeNotificar) {
    try {
      await notificarCambioEstado(id, 'recibido_usa')
    } catch (err) {
      console.error('[asignar] notificarCambioEstado:', err)
    }
  }

  return NextResponse.json({
    ok: true,
    cliente: { nombre: cliente.nombre_completo, casilla: cliente.numero_casilla },
    notificacion: { intentada: debeNotificar },
  })
}
