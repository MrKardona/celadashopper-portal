// GET /api/admin/recibir/historial
// Devuelve los paquetes recibidos en USA hoy (admin only)

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Paquetes recibidos hoy (UTC midnight)
  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)

  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, tracking_usaco, descripcion, peso_libras, cliente_id, fecha_recepcion_usa, estado')
    .gte('fecha_recepcion_usa', hoy.toISOString())
    .order('fecha_recepcion_usa', { ascending: false })
    .limit(50)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ paquetes: [] })
  }

  // Cargar perfiles de los clientes asociados
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string | null }> = {}

  if (clienteIds.length > 0) {
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla')
      .in('id', clienteIds)

    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = { nombre_completo: p.nombre_completo, numero_casilla: p.numero_casilla }
    }
  }

  // Conteo de fotos por paquete
  const paqueteIds = paquetes.map(p => p.id)
  const fotosMap: Record<string, number> = {}
  if (paqueteIds.length > 0) {
    const { data: fotos } = await admin
      .from('fotos_paquetes')
      .select('paquete_id')
      .in('paquete_id', paqueteIds)

    for (const f of fotos ?? []) {
      fotosMap[f.paquete_id] = (fotosMap[f.paquete_id] ?? 0) + 1
    }
  }

  const enriquecidos = paquetes.map(p => ({
    id: p.id,
    tracking_casilla: p.tracking_casilla,
    tracking_origen: p.tracking_origen,
    tracking_usaco: p.tracking_usaco,
    descripcion: p.descripcion,
    peso_libras: p.peso_libras,
    fecha_recepcion_usa: p.fecha_recepcion_usa,
    estado: p.estado,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    sin_asignar: !p.cliente_id,
    fotos_count: fotosMap[p.id] ?? 0,
  }))

  return NextResponse.json({ paquetes: enriquecidos })
}
