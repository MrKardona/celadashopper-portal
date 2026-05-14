// GET  /api/admin/domicilios-manuales?domiciliario_id=...
// POST /api/admin/domicilios-manuales

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

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const domId = req.nextUrl.searchParams.get('domiciliario_id')
  let q = ctx.admin.from('domicilios_manuales').select('*').order('orden').order('created_at')
  if (domId) q = q.eq('domiciliario_id', domId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json() as {
    domiciliario_id: string
    nombre: string
    direccion: string
    telefono?: string | null
    notas?: string | null
    tipo?: 'personal' | 'servicios' | 'productos'
  }

  if (!body.domiciliario_id || !body.nombre?.trim() || !body.direccion?.trim()) {
    return NextResponse.json({ error: 'domiciliario_id, nombre y direccion son obligatorios' }, { status: 400 })
  }

  // Calcular orden = max actual + 1 para ese domiciliario
  const { data: last } = await ctx.admin
    .from('domicilios_manuales')
    .select('orden')
    .eq('domiciliario_id', body.domiciliario_id)
    .eq('estado', 'pendiente')
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle()

  const orden = (last?.orden ?? -1) + 1

  const { data, error } = await ctx.admin
    .from('domicilios_manuales')
    .insert({
      domiciliario_id: body.domiciliario_id,
      nombre:    body.nombre.trim(),
      direccion: body.direccion.trim(),
      telefono:  body.telefono?.trim() || null,
      notas:     body.notas?.trim() || null,
      tipo:      body.tipo ?? 'productos',
      orden,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
