// GET /api/domiciliario/paquetes
// Devuelve los paquetes asignados al domiciliario autenticado

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'domiciliario') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: paquetes, error } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega, estado, fecha_asignacion_domiciliario')
    .eq('domiciliario_id', user.id)
    .in('estado', ['en_camino_cliente', 'en_bodega_local'])
    .order('fecha_asignacion_domiciliario', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = paquetes ?? []
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; whatsapp: string | null; telefono: string | null; direccion: string | null; barrio: string | null; referencia: string | null }> = {}

  if (clienteIds.length > 0) {
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, direccion, barrio, referencia')
      .in('id', clienteIds)
    for (const p of perfiles ?? []) perfilesMap[p.id] = p
  }

  return NextResponse.json({
    paquetes: lista.map(p => ({
      ...p,
      cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    })),
  })
}
