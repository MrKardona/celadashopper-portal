// GET  /api/admin/recibir-colombia?tracking_usaco=XXX
//   Devuelve todos los paquetes en una caja USACO específica
// POST /api/admin/recibir-colombia
//   Confirma recepción de la caja: todos los paquetes pasan a 'en_bodega_local'
//   y se notifica a cada cliente vía WhatsApp

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

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
  if (perfil?.rol !== 'admin') return null
  return user
}

// ─── GET: buscar paquetes por tracking USACO ────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const trackingUsaco = req.nextUrl.searchParams.get('tracking_usaco')?.trim()
  if (!trackingUsaco) {
    return NextResponse.json({ error: 'tracking_usaco requerido' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Buscar todos los paquetes con ese tracking USACO
  const { data: paquetes, error } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_usaco, descripcion, categoria, peso_libras, estado, cliente_id, bodega_destino')
    .ilike('tracking_usaco', trackingUsaco)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'No se encontraron paquetes con ese tracking USACO', caja: null }, { status: 404 })
  }

  // Cargar perfiles de los clientes
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

  // Estadísticas de la caja
  const estados = paquetes.reduce((acc: Record<string, number>, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {})
  const pesoTotal = paquetes.reduce((sum, p) => sum + Number(p.peso_libras ?? 0), 0)
  const sinAsignar = paquetes.filter(p => !p.cliente_id).length
  const yaRecibidos = paquetes.filter(p =>
    ['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
  ).length

  return NextResponse.json({
    caja: {
      tracking_usaco: trackingUsaco,
      total: paquetes.length,
      peso_total: pesoTotal,
      sin_asignar: sinAsignar,
      ya_recibidos_colombia: yaRecibidos,
      estados,
      paquetes: paquetes.map(p => ({
        ...p,
        cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
      })),
    },
  })
}

// ─── POST: confirmar recepción del lote en Colombia ─────────────────────────
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    tracking_usaco?: string
    paquete_ids?: string[]    // si vienen, solo confirma estos; sino todos del USACO
    bodega_destino?: string   // opcional para forzar bodega
    notas?: string
    notificar?: boolean
  }

  const trackingUsaco = body.tracking_usaco?.trim()
  if (!trackingUsaco) {
    return NextResponse.json({ error: 'tracking_usaco requerido' }, { status: 400 })
  }

  const debeNotificar = body.notificar !== false
  const admin = getSupabaseAdmin()

  // Cargar paquetes a procesar
  let query = admin
    .from('paquetes')
    .select('id, estado, cliente_id, bodega_destino, tracking_casilla')
    .ilike('tracking_usaco', trackingUsaco)

  if (body.paquete_ids && body.paquete_ids.length > 0) {
    query = query.in('id', body.paquete_ids)
  }

  const { data: paquetes, error: errPaq } = await query

  if (errPaq) return NextResponse.json({ error: errPaq.message }, { status: 500 })
  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'No se encontraron paquetes' }, { status: 404 })
  }

  // Filtrar los que aún no están en Colombia (evitar reprocesamiento)
  const aProcesar = paquetes.filter(p =>
    !['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
  )

  if (aProcesar.length === 0) {
    return NextResponse.json({
      ok: true,
      ya_estaban: true,
      mensaje: 'Todos los paquetes ya estaban recibidos en Colombia',
      total: paquetes.length,
    })
  }

  // Actualizar todos en bloque
  const ahora = new Date().toISOString()
  const { error: updErr } = await admin
    .from('paquetes')
    .update({
      estado: 'en_bodega_local',
      updated_at: ahora,
      ...(body.bodega_destino ? { bodega_destino: body.bodega_destino } : {}),
    })
    .in('id', aProcesar.map(p => p.id))

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Registrar evento por cada paquete
  const eventos = aProcesar.map(p => ({
    paquete_id: p.id,
    estado_anterior: p.estado,
    estado_nuevo: 'en_bodega_local',
    descripcion: body.notas
      ? `Recibido en bodega Colombia (lote ${trackingUsaco}). ${body.notas}`
      : `Recibido en bodega Colombia (lote USACO ${trackingUsaco})`,
    ubicacion: 'Colombia',
  }))
  await admin.from('eventos_paquete').insert(eventos)
    .then(() => {/* ok */}, (e) => console.error('[recibir-colombia] eventos:', e))

  // Notificar a cada cliente vía WhatsApp (con pequeño delay entre cada uno)
  let notificados = 0
  let fallidos = 0
  if (debeNotificar) {
    for (const p of aProcesar) {
      if (!p.cliente_id) continue
      try {
        await notificarCambioEstado(p.id, 'en_bodega_local')
        notificados++
        // pequeño delay para no saturar Meta API
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        fallidos++
        console.error(`[recibir-colombia] notif fallida ${p.id}:`, err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    procesados: aProcesar.length,
    total_en_caja: paquetes.length,
    notificados,
    fallidos,
    sin_cliente: aProcesar.filter(p => !p.cliente_id).length,
  })
}
