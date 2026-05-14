// GET  /api/admin/domiciliarios/planilla?fecha=YYYY-MM-DD
// PATCH /api/admin/domiciliarios/planilla  { tipo, id, valor }

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return admin
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fechaParam = req.nextUrl.searchParams.get('fecha')
  const fechaBog   = fechaParam ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const inicio = new Date(`${fechaBog}T05:00:00.000Z`)
  const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1)

  const { data: domiciliarios } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .eq('rol', 'domiciliario')
    .eq('activo', true)
    .order('nombre_completo')

  const domIds = (domiciliarios ?? []).map(d => d.id)
  if (!domIds.length) return NextResponse.json({ domiciliarios: [], paquetes: [], manuales: [] })

  const [paqRes, manRes] = await Promise.all([
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, cliente_id, domiciliario_id, updated_at, valor_domicilio')
      .in('domiciliario_id', domIds)
      .eq('estado', 'entregado')
      .is('paquete_origen_id', null)
      .gte('updated_at', inicio.toISOString())
      .lte('updated_at', fin.toISOString())
      .order('domiciliario_id').order('updated_at'),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, tipo, domiciliario_id, completado_at, valor')
      .in('domiciliario_id', domIds)
      .eq('estado', 'completado')
      .gte('completado_at', inicio.toISOString())
      .lte('completado_at', fin.toISOString())
      .order('domiciliario_id').order('completado_at'),
  ])

  // Nombres de clientes
  const clienteIds = [...new Set((paqRes.data ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    for (const p of pfs ?? []) clienteNombres[p.id] = p.nombre_completo
  }

  const paquetes = (paqRes.data ?? []).map(p => ({
    ...p,
    cliente_nombre: p.cliente_id ? (clienteNombres[p.cliente_id] ?? '') : '',
  }))

  return NextResponse.json({ domiciliarios: domiciliarios ?? [], paquetes, manuales: manRes.data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json() as { tipo: 'paquete' | 'manual'; id: string; valor: number | null }

  if (!body.id || !['paquete', 'manual'].includes(body.tipo)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  if (body.tipo === 'paquete') {
    const { error } = await admin.from('paquetes').update({ valor_domicilio: body.valor }).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await admin.from('domicilios_manuales').update({ valor: body.valor }).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
