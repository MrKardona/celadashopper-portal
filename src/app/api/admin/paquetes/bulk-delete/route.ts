// POST /api/admin/paquetes/bulk-delete
// Elimina múltiples paquetes en un solo request (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { ids?: string[] }
  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
  }

  const ids = body.ids

  // Notificaciones no tienen CASCADE — borrar primero
  await admin.from('notificaciones').delete().in('paquete_id', ids)

  const { error } = await admin.from('paquetes').delete().in('id', ids)
  if (error) {
    console.error('[bulk-delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, eliminados: ids.length })
}
