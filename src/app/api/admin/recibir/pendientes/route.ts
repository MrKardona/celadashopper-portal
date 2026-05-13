// GET /api/admin/recibir/pendientes
// Paquetes reportados por clientes que aún no han llegado a bodega USA
// (estado = 'reportado'). Se usa en la pantalla de recepción como lista de espera.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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

  if (!perfil || !['admin', 'agente_usa'].includes(perfil.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Paquetes reportados, ordenados por fecha de reporte (más reciente primero)
  const { data: paquetes, error } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, tienda, categoria, bodega_destino, cliente_id, created_at, notas_cliente, valor_declarado, cantidad, fecha_compra, fecha_estimada_llegada')
    .eq('estado', 'reportado')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!paquetes || paquetes.length === 0) return NextResponse.json({ paquetes: [] })

  // Cargar perfiles de clientes
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string | null; ciudad: string | null }> = {}

  if (clienteIds.length > 0) {
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla, ciudad')
      .in('id', clienteIds)

    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = {
        nombre_completo: p.nombre_completo,
        numero_casilla: p.numero_casilla,
        ciudad: p.ciudad,
      }
    }
  }

  const enriquecidos = paquetes.map(p => ({
    id: p.id,
    tracking_casilla: p.tracking_casilla,
    tracking_origen: p.tracking_origen,
    descripcion: p.descripcion,
    tienda: p.tienda,
    categoria: p.categoria,
    bodega_destino: p.bodega_destino,
    notas_cliente: p.notas_cliente,
    valor_declarado: p.valor_declarado,
    cantidad: p.cantidad,
    fecha_compra: p.fecha_compra,
    fecha_estimada_llegada: p.fecha_estimada_llegada,
    created_at: p.created_at,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
  }))

  return NextResponse.json({ paquetes: enriquecidos })
}
