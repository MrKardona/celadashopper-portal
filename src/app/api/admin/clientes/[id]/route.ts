// PATCH /api/admin/clientes/[id] — admin edita información de un cliente
// Permite modificar nombre, teléfono, whatsapp, ciudad, casilla y estado activo.
// El email queda bloqueado (requiere flujo de auth aparte).

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
    telefono?: string | null
    whatsapp?: string | null
    ciudad?: string | null
    numero_casilla?: string
    activo?: boolean
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.nombre_completo === 'string' && body.nombre_completo.trim()) {
    updates.nombre_completo = body.nombre_completo.trim()
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

  return NextResponse.json({ ok: true })
}
