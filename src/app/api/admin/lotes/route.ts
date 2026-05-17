// POST /api/admin/lotes
// Crea un lote de entrega agrupando varios paquetes del mismo cliente.
// Los paquetes siguen siendo visibles al cliente por separado; solo el admin
// los opera como una unidad (un domiciliario, una entrega, una notificación).

import { NextRequest, NextResponse } from 'next/server'
import { verificarAdmin } from '@/lib/auth/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as { paquete_ids: string[]; notas?: string }

  if (!body.paquete_ids || body.paquete_ids.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 paquetes para crear un lote' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Cargar paquetes y validar
  const { data: paquetes, error: errFetch } = await admin
    .from('paquetes')
    .select('id, cliente_id, estado, lote_entrega_id')
    .in('id', body.paquete_ids)

  if (errFetch || !paquetes || paquetes.length !== body.paquete_ids.length) {
    return NextResponse.json({ error: 'No se encontraron todos los paquetes' }, { status: 400 })
  }

  // Mismo cliente
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id))]
  if (clienteIds.length > 1 || !clienteIds[0]) {
    return NextResponse.json({ error: 'Solo se pueden agrupar paquetes del mismo cliente' }, { status: 400 })
  }

  // No entregados ni devueltos
  const noPermitidos = paquetes.filter(p => ['entregado', 'devuelto', 'retenido'].includes(p.estado))
  if (noPermitidos.length > 0) {
    return NextResponse.json({ error: 'No se pueden agrupar paquetes ya entregados o devueltos' }, { status: 400 })
  }

  // Alguno ya tiene lote? Disolver antes de crear uno nuevo
  const yaEnLote = paquetes.filter(p => p.lote_entrega_id)
  if (yaEnLote.length > 0) {
    return NextResponse.json({ error: 'Uno o más paquetes ya están en un lote. Disuelve el lote existente primero.' }, { status: 400 })
  }

  const ahora = new Date().toISOString()

  // Crear el registro de lote
  const { data: lote, error: errLote } = await admin
    .from('lotes_entrega')
    .insert({ notas: body.notas ?? null, created_at: ahora, updated_at: ahora })
    .select('id')
    .single()

  if (errLote || !lote) {
    return NextResponse.json({ error: 'Error creando el lote' }, { status: 500 })
  }

  // Vincular paquetes al lote
  const { error: errUpdate } = await admin
    .from('paquetes')
    .update({ lote_entrega_id: lote.id, updated_at: ahora })
    .in('id', body.paquete_ids)

  if (errUpdate) {
    // Rollback: eliminar lote huérfano
    await admin.from('lotes_entrega').delete().eq('id', lote.id)
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: lote.id })
}
