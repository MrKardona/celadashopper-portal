// DELETE /api/admin/domicilios-manuales/[id]
// PATCH  /api/admin/domicilios-manuales/[id]

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return { user, admin }
}

interface Props { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Props) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { error } = await ctx.admin.from('domicilios_manuales').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as Partial<{
    nombre: string
    direccion: string
    telefono: string | null
    notas: string | null
    orden: number
    estado: string
  }>

  const { data, error } = await ctx.admin
    .from('domicilios_manuales')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
