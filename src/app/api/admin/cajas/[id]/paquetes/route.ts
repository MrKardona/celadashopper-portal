// POST   /api/admin/cajas/[id]/paquetes        — agregar paquete a la caja por tracking
// DELETE /api/admin/cajas/[id]/paquetes?id=XXX — quitar paquete de la caja

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
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

interface Props {
  params: Promise<{ id: string }>
}

// ─── POST: agregar paquete a la caja por tracking ───────────────────────────
export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: cajaId } = await params
  const body = await req.json() as { tracking?: string; ignorar_bodega?: boolean }
  const tracking = body.tracking?.trim()
  if (!tracking) return NextResponse.json({ error: 'tracking requerido' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // 1. Verificar caja: debe estar abierta
  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('id, estado, bodega_destino')
    .eq('id', cajaId)
    .maybeSingle()

  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  if (caja.estado !== 'abierta') {
    return NextResponse.json({ error: 'Solo cajas abiertas aceptan paquetes' }, { status: 400 })
  }

  // 2. Buscar el paquete por tracking_casilla o tracking_origen
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, descripcion, estado, caja_id, bodega_destino, cliente_id')
    .or(`tracking_casilla.ilike.${tracking},tracking_origen.ilike.${tracking}`)
    .limit(2)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'Paquete no encontrado con ese tracking' }, { status: 404 })
  }
  if (paquetes.length > 1) {
    return NextResponse.json({ error: 'Múltiples paquetes coinciden, usa el tracking exacto CLD' }, { status: 400 })
  }

  const paquete = paquetes[0]

  // 3. Validaciones
  if (paquete.caja_id === cajaId) {
    return NextResponse.json({ error: 'Este paquete ya está en esta caja', codigo: 'duplicado' }, { status: 409 })
  }
  if (paquete.caja_id) {
    return NextResponse.json({
      error: 'Este paquete ya está en otra caja. Quítalo de allí primero.',
      codigo: 'en_otra_caja',
    }, { status: 409 })
  }
  // Estados elegibles: recibido_usa, listo_envio o en_consolidacion (huérfano)
  const estadosElegibles = ['recibido_usa', 'listo_envio', 'en_consolidacion']
  if (!estadosElegibles.includes(paquete.estado)) {
    return NextResponse.json({
      error: `El paquete está en estado "${paquete.estado}". Solo se pueden consolidar paquetes en estado "Recibido en USA", "En consolidación" o "Listo para envío".`,
      codigo: 'estado_invalido',
    }, { status: 400 })
  }
  // Permitimos paquetes sin cliente (se podrán despachar y asignar después)

  // 4. Si la bodega del paquete no coincide con la de la caja, advertir
  if (paquete.bodega_destino !== caja.bodega_destino && !body.ignorar_bodega) {
    return NextResponse.json({
      error: `El paquete va a "${paquete.bodega_destino}" pero la caja va a "${caja.bodega_destino}". ¿Confirmas que quieres meterlo igual?`,
      codigo: 'bodega_distinta',
      paquete_bodega: paquete.bodega_destino,
      caja_bodega: caja.bodega_destino,
    }, { status: 409 })
  }

  // 5. Asignar paquete a la caja y cambiar estado a en_consolidacion
  const { error: updErr } = await admin
    .from('paquetes')
    .update({
      caja_id: cajaId,
      estado: 'en_consolidacion',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paquete.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // 6. Registrar evento (usa el estado real anterior)
  await admin.from('eventos_paquete').insert({
    paquete_id: paquete.id,
    estado_anterior: paquete.estado,
    estado_nuevo: 'en_consolidacion',
    descripcion: `Agregado a caja consolidada para ${caja.bodega_destino}`,
    ubicacion: 'Miami, USA',
  }).then(() => {/* ok */}, (e) => console.error('[caja+paquete] evento:', e))

  return NextResponse.json({
    ok: true,
    paquete: {
      id: paquete.id,
      tracking_casilla: paquete.tracking_casilla,
      descripcion: paquete.descripcion,
    },
  })
}

// ─── DELETE: quitar paquete de la caja ──────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: cajaId } = await params
  const paqueteId = req.nextUrl.searchParams.get('id')
  if (!paqueteId) return NextResponse.json({ error: 'id de paquete requerido' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Verificar caja abierta
  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('estado')
    .eq('id', cajaId)
    .maybeSingle()

  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  if (caja.estado !== 'abierta') {
    return NextResponse.json({ error: 'Solo cajas abiertas permiten quitar paquetes' }, { status: 400 })
  }

  // Quitar y devolver a estado recibido_usa
  const { error } = await admin
    .from('paquetes')
    .update({
      caja_id: null,
      estado: 'recibido_usa',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paqueteId)
    .eq('caja_id', cajaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('eventos_paquete').insert({
    paquete_id: paqueteId,
    estado_anterior: 'en_consolidacion',
    estado_nuevo: 'recibido_usa',
    descripcion: 'Sacado de caja consolidada',
    ubicacion: 'Miami, USA',
  }).then(() => {/* ok */}, (e) => console.error('[caja-paquete] evento:', e))

  return NextResponse.json({ ok: true })
}
