// PATCH /api/admin/paquetes/[id]/direccion
// Guarda la dirección de entrega de un paquete (cuando no tenía)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { direccion_entrega } = await req.json() as { direccion_entrega?: string }
  if (!direccion_entrega?.trim()) return NextResponse.json({ error: 'Dirección requerida' }, { status: 400 })

  const { error } = await admin.from('paquetes').update({ direccion_entrega: direccion_entrega.trim() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
