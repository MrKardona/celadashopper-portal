// PATCH  /api/admin/clientes/[id] — admin edita información de un cliente
// DELETE /api/admin/clientes/[id] — admin elimina cuenta del cliente
//
// El email queda bloqueado en PATCH (requiere flujo de auth aparte).
// DELETE valida que el cliente no tenga paquetes activos antes de eliminar.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizarTelefono(raw: string | null | undefined): string | null {
  if (!raw) return null
  const limpio = raw.replace(/[^\d+]/g, '').trim()
  if (!limpio) return null
  if (!limpio.startsWith('+')) {
    const sinCero = limpio.replace(/^0+/, '')
    return sinCero.startsWith('57') ? `+${sinCero}` : `+57${sinCero}`
  }
  return limpio
}

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Props) {
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

  const body = await req.json() as {
    nombre_completo?: string
    email?: string
    telefono?: string | null
    whatsapp?: string | null
    ciudad?: string | null
    direccion?: string | null
    barrio?: string | null
    referencia?: string | null
    numero_casilla?: string
    activo?: boolean
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.nombre_completo === 'string' && body.nombre_completo.trim()) {
    updates.nombre_completo = body.nombre_completo.trim()
  }

  // Email: si viene en el body, validar y actualizar tanto auth.users como perfiles
  let nuevoEmail: string | null = null
  if (typeof body.email === 'string') {
    const emailLimpio = body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    // Buscar duplicados (otro perfil con ese email)
    const { data: dup } = await admin
      .from('perfiles')
      .select('id')
      .eq('email', emailLimpio)
      .neq('id', id)
      .maybeSingle()
    if (dup) {
      return NextResponse.json({
        error: 'Ese correo ya está siendo usado por otro cliente',
      }, { status: 409 })
    }
    nuevoEmail = emailLimpio
    updates.email = emailLimpio
  }
  if (body.telefono !== undefined) {
    updates.telefono = normalizarTelefono(body.telefono)
  }
  if (body.whatsapp !== undefined) {
    updates.whatsapp = normalizarTelefono(body.whatsapp)
  }
  if (body.ciudad !== undefined) {
    updates.ciudad = (typeof body.ciudad === 'string' ? body.ciudad.trim() : null) || null
  }
  if (body.direccion !== undefined) {
    updates.direccion = (typeof body.direccion === 'string' ? body.direccion.trim() : null) || null
  }
  if (body.barrio !== undefined) {
    updates.barrio = (typeof body.barrio === 'string' ? body.barrio.trim() : null) || null
  }
  if (body.referencia !== undefined) {
    updates.referencia = (typeof body.referencia === 'string' ? body.referencia.trim() : null) || null
  }
  if (typeof body.numero_casilla === 'string' && body.numero_casilla.trim()) {
    updates.numero_casilla = body.numero_casilla.trim()
  }
  if (typeof body.activo === 'boolean') {
    updates.activo = body.activo
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  // Si se cambia numero_casilla, validar que no esté duplicado
  if (typeof updates.numero_casilla === 'string') {
    const { data: existente } = await admin
      .from('perfiles')
      .select('id')
      .eq('numero_casilla', updates.numero_casilla)
      .neq('id', id)
      .maybeSingle()

    if (existente) {
      return NextResponse.json({
        error: `La casilla ${updates.numero_casilla} ya pertenece a otro cliente`,
      }, { status: 409 })
    }
  }

  const { error } = await admin
    .from('perfiles')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('[admin/clientes PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si se cambió el email, propagar también a auth.users.
  // email_confirm:true marca el nuevo email como confirmado sin pedir verificación.
  if (nuevoEmail) {
    const { error: errAuth } = await admin.auth.admin.updateUserById(id, {
      email: nuevoEmail,
      email_confirm: true,
    })
    if (errAuth) {
      console.error('[admin/clientes PATCH] auth.users:', errAuth.message)
      // El perfil ya cambió. Avisamos al admin que auth no se sincronizó.
      return NextResponse.json({
        ok: true,
        warning: `El email del perfil se actualizó pero falló la sincronización con la cuenta de auth: ${errAuth.message}`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE: eliminar cliente ───────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Props) {
  const { id } = await params

  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (user.id === id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: perfilAdmin } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfilAdmin || perfilAdmin.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Cargar el perfil del cliente a eliminar
  const { data: cliente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, rol')
    .eq('id', id)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  if (cliente.rol === 'admin') {
    return NextResponse.json({
      error: 'No se puede eliminar a otro admin desde aquí',
    }, { status: 400 })
  }

  // Verificar paquetes activos. Si tiene → exigir ?force=1 para confirmar
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'

  const { data: paquetesActivos } = await admin
    .from('paquetes')
    .select('id, estado')
    .eq('cliente_id', id)
    .not('estado', 'in', '(entregado,devuelto)')

  const activos = paquetesActivos?.length ?? 0

  if (activos > 0 && !force) {
    return NextResponse.json({
      error: 'paquetes_activos',
      mensaje: `Este cliente tiene ${activos} paquete${activos > 1 ? 's' : ''} en proceso. Confirma para eliminarlo de todos modos.`,
      paquetes_activos: activos,
    }, { status: 409 })
  }

  // Desasignar paquetes (no se borran, quedan sin cliente_id) — preserva auditoría
  await admin
    .from('paquetes')
    .update({ cliente_id: null })
    .eq('cliente_id', id)

  // Eliminar el perfil. Si el schema tiene FK ON DELETE CASCADE, borrar
  // auth.users borrará perfil. Aquí lo hacemos en orden seguro.
  const { error: errPerfil } = await admin.from('perfiles').delete().eq('id', id)
  if (errPerfil) {
    console.error('[admin/clientes DELETE] perfil:', errPerfil)
    return NextResponse.json({ error: errPerfil.message }, { status: 500 })
  }

  // Eliminar de auth.users (Supabase Auth) — service role tiene permiso
  const { error: errAuth } = await admin.auth.admin.deleteUser(id)
  if (errAuth) {
    // Si falla, no es bloqueante: el perfil ya se borró. Lo logueamos.
    console.error('[admin/clientes DELETE] auth.users:', errAuth.message)
  }

  return NextResponse.json({
    ok: true,
    nombre_eliminado: cliente.nombre_completo,
    paquetes_desasignados: activos,
  })
}
