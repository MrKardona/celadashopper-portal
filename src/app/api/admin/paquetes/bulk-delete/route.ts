// POST /api/admin/paquetes/bulk-delete
// Elimina múltiples paquetes en un solo request (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const body = await req.json() as { ids?: string[] }
  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
  }

  // Validar que todos los ids sean UUIDs válidos antes de pasarlos a la query
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ids = body.ids.filter(id => UUID_RE.test(id))
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids inválidos' }, { status: 400 })
  }

  // Capturar datos antes de borrar para el log
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, estado, categoria, tienda, cliente_id, peso_libras, costo_servicio, valor_declarado')
    .in('id', ids)

  // Nombre del admin que elimina
  const { data: adminPerfil } = await admin
    .from('perfiles').select('nombre_completo').eq('id', user.id).single()

  // Nombres de clientes
  const clienteIds = [...new Set((paquetes ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: clis } = await admin.from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    for (const c of clis ?? []) clienteNombres[c.id] = c.nombre_completo
  }

  // Insertar log
  if (paquetes && paquetes.length > 0) {
    const logs = paquetes.map(p => ({
      paquete_id:           p.id,
      tracking_casilla:     p.tracking_casilla,
      tracking_origen:      p.tracking_origen,
      descripcion:          p.descripcion,
      estado:               p.estado,
      categoria:            p.categoria,
      tienda:               p.tienda,
      cliente_id:           p.cliente_id,
      cliente_nombre:       p.cliente_id ? (clienteNombres[p.cliente_id] ?? null) : null,
      peso_libras:          p.peso_libras,
      costo_servicio:       p.costo_servicio,
      valor_declarado:      p.valor_declarado,
      eliminado_por:        user.id,
      eliminado_por_nombre: adminPerfil?.nombre_completo ?? null,
    }))
    await admin.from('paquetes_eliminados').insert(logs)
      .then(() => {/* ok */}, (e) => console.error('[bulk-delete] log:', e))
  }

  // Notificaciones no tienen CASCADE — borrar primero
  await admin.from('notificaciones').delete().in('paquete_id', ids)

  const { error } = await admin.from('paquetes').delete().in('id', ids)
  if (error) {
    console.error('[bulk-delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, eliminados: ids.length })
}
