// PATCH /api/admin/tarifas/[id]
// Actualiza una tarifa (solo admin)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

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
  const { tarifa_por_libra, precio_fijo, tarifa_tipo, seguro_porcentaje, descripcion, costo_envio_libra, costo_envio_fijo } = body

  const { error } = await supabaseAdmin
    .from('categorias_tarifas')
    .update({ tarifa_por_libra, precio_fijo, tarifa_tipo, seguro_porcentaje, descripcion, costo_envio_libra, costo_envio_fijo, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
