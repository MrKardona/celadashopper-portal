// GET    /api/admin/cajas/[id]            — detalle de la caja + paquetes adentro
// PATCH  /api/admin/cajas/[id]            — actualizar peso, notas, courier
// DELETE /api/admin/cajas/[id]            — borrar caja (solo si está abierta y vacía)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

interface Props {
  params: Promise<{ id: string }>
}

// ─── GET: detalle de caja ──────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: caja, error } = await admin
    .from('cajas_consolidacion')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })

  // Cargar paquetes en la caja
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, descripcion, categoria, peso_libras, valor_declarado, estado, cliente_id, bodega_destino')
    .eq('caja_id', id)
    .order('created_at', { ascending: true })

  // Cargar perfiles de los clientes
  const clienteIds = [...new Set((paquetes ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
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

  // Segunda foto de cada paquete
  const paqueteIds = (paquetes ?? []).map(p => p.id)
  const fotosMap: Record<string, string> = {}
  if (paqueteIds.length > 0) {
    const { data: fotos } = await admin
      .from('fotos_paquetes')
      .select('paquete_id, url')
      .in('paquete_id', paqueteIds)
      .order('created_at', { ascending: true })
    const acum: Record<string, string[]> = {}
    for (const f of fotos ?? []) {
      if (!acum[f.paquete_id]) acum[f.paquete_id] = []
      acum[f.paquete_id].push(f.url)
    }
    for (const [pid, urls] of Object.entries(acum)) {
      fotosMap[pid] = urls[1] ?? urls[0]
    }
  }

  const paquetesConCliente = (paquetes ?? []).map(p => ({
    ...p,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    foto_url: fotosMap[p.id] ?? null,
  }))

  const pesoSuma = (paquetes ?? []).reduce((s, p) => s + Number(p.peso_libras ?? 0), 0)

  return NextResponse.json({
    caja: { ...caja, peso_suma_paquetes: pesoSuma },
    paquetes: paquetesConCliente,
  })
}

// ─── PATCH: actualizar caja (notas, peso, courier) ─────────────────────────
export async function PATCH(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    notas?: string | null
    courier?: string | null
    peso_estimado?: number | null
    peso_real?: number | null
    bodega_destino?: string
    costo_total_usaco?: number | null
    tracking_usaco?: string | null
    estado?: string
  }

  const ESTADOS_VALIDOS = ['abierta', 'cerrada', 'despachada', 'recibida_colombia']
  const admin = getSupabaseAdmin()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.notas !== undefined) updates.notas = body.notas
  if (body.courier !== undefined) updates.courier = body.courier
  if (body.peso_estimado !== undefined) updates.peso_estimado = body.peso_estimado
  if (body.peso_real !== undefined) updates.peso_real = body.peso_real
  if (body.bodega_destino !== undefined) updates.bodega_destino = body.bodega_destino
  if (body.costo_total_usaco !== undefined) updates.costo_total_usaco = body.costo_total_usaco
  if (body.tracking_usaco !== undefined) updates.tracking_usaco = body.tracking_usaco?.trim() || null
  if (body.estado !== undefined && ESTADOS_VALIDOS.includes(body.estado)) updates.estado = body.estado

  const { error } = await admin
    .from('cajas_consolidacion')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si se cambió el tracking_usaco, propagarlo a todos los paquetes de la caja
  if (body.tracking_usaco !== undefined) {
    await admin
      .from('paquetes')
      .update({
        tracking_usaco: body.tracking_usaco?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('caja_id', id)
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE: borrar caja (libera paquetes a recibido_usa) ───────────────────
export async function DELETE(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, estado')
    .eq('id', id)
    .maybeSingle()

  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })

  // Cargar paquetes asociados
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, estado')
    .eq('caja_id', id)

  const cantidadPaquetes = paquetes?.length ?? 0

  // Si hay paquetes, devolverlos a 'recibido_usa' y limpiar caja_id + tracking_usaco si fue heredado
  if (cantidadPaquetes > 0 && paquetes) {
    const ahora = new Date().toISOString()

    const { error: updErr } = await admin
      .from('paquetes')
      .update({
        caja_id: null,
        estado: 'recibido_usa',
        // Si el tracking USACO fue heredado de la caja, limpiarlo también
        tracking_usaco: null,
        updated_at: ahora,
      })
      .eq('caja_id', id)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Registrar evento por cada paquete
    const eventos = paquetes.map(p => ({
      paquete_id: p.id,
      estado_anterior: p.estado,
      estado_nuevo: 'recibido_usa',
      descripcion: `Caja eliminada (${caja.codigo_interno}) — paquete liberado`,
      ubicacion: 'Miami, USA',
    }))
    await admin.from('eventos_paquete').insert(eventos)
      .then(() => {/* ok */}, (e) => console.error('[caja delete] eventos:', e))
  }

  const { error } = await admin.from('cajas_consolidacion').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    paquetes_liberados: cantidadPaquetes,
  })
}
