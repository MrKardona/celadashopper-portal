// POST /api/domiciliario/domicilios-manuales/[id]/completar

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface Props { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Props) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'domiciliario') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  const { data, error } = await admin
    .from('domicilios_manuales')
    .update({ estado: 'completado', completado_at: new Date().toISOString() })
    .eq('id', id)
    .eq('domiciliario_id', user.id)   // solo puede completar los suyos
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado o no asignado a ti' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
