// PATCH /api/admin/paquetes/[id]
// Actualiza datos del paquete y dispara notificación WhatsApp si el estado cambia

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

export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  // Verificar que el usuario es admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json()
  const {
    estado, bodega_destino, peso_libras, tarifa_aplicada,
    costo_servicio, tracking_usaco, notas_cliente,
    notificar, estado_anterior,
  } = body

  // Calcular peso facturable (tomamos el mismo peso por ahora)
  const pesoFacturable = peso_libras ?? null

  const updates: Record<string, unknown> = {}
  if (estado !== undefined) updates.estado = estado
  if (bodega_destino !== undefined) updates.bodega_destino = bodega_destino
  if (peso_libras !== undefined) updates.peso_libras = peso_libras
  if (pesoFacturable !== undefined) updates.peso_facturable = pesoFacturable
  if (tarifa_aplicada !== undefined) updates.tarifa_aplicada = tarifa_aplicada
  if (costo_servicio !== undefined) updates.costo_servicio = costo_servicio
  if (tracking_usaco !== undefined) updates.tracking_usaco = tracking_usaco
  if (notas_cliente !== undefined) updates.notas_cliente = notas_cliente

  const { error } = await supabaseAdmin
    .from('paquetes')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('[admin/paquetes PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si el estado cambió y se quiere notificar, disparar WhatsApp
  let notificado = false
  const estadoCambio = estado && estado !== estado_anterior
  if (estadoCambio && notificar !== false) {
    try {
      await notificarCambioEstado(id, estado)
      notificado = true
    } catch (err) {
      console.error('[admin/paquetes PATCH] Notificación fallida:', err)
    }
  }

  return NextResponse.json({ ok: true, notificado })
}
