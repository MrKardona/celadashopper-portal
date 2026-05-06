// PATCH  /api/admin/tarifas/rangos/[id] — editar
// DELETE /api/admin/tarifas/rangos/[id] — eliminar

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

export async function PATCH(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  // Whitelist de campos editables
  const editables = [
    'categoria', 'condicion', 'min_unidades', 'max_unidades',
    'precio_por_unidad', 'cargo_fijo', 'tarifa_por_libra',
    'peso_minimo_facturable', 'seguro_porcentaje',
    'valor_min', 'valor_max', 'prioridad', 'notas', 'activo',
  ]
  const updates: Record<string, unknown> = {}
  for (const k of editables) {
    if (k in body) updates[k] = body[k]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('tarifas_rangos').update(updates).eq('id', id)
  if (error) {
    console.error('[tarifas/rangos PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('tarifas_rangos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
