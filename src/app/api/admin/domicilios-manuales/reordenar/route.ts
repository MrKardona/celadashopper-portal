// PATCH /api/admin/domicilios-manuales/reordenar
// Body: { items: { id: string; orden: number }[] }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json() as { items?: { id: string; orden: number }[] }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items requeridos' }, { status: 400 })
  }

  await Promise.all(
    body.items.map(({ id, orden }) =>
      admin.from('domicilios_manuales').update({ orden }).eq('id', id)
    )
  )

  return NextResponse.json({ ok: true })
}
