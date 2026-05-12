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
    .select('id, tracking_casilla, tracking_usaco, descripcion, categoria, peso_libras, estado, cliente_id, bodega_destino, paquete_origen_id')
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

  // Detectar sub-paquetes con hermanos pendientes en otras cajas
  // Un sub-paquete "espera hermanos" cuando algún hermano (mismo paquete_origen_id)
  // NO está en esta caja Y aún no ha llegado a Colombia.
  const idsEnEstaCaja = new Set(paquetes.map(p => p.id))
  const origenIds = [...new Set(
    paquetes.filter(p => p.paquete_origen_id).map(p => p.paquete_origen_id as string)
  )]

  const esperaHermanosSet = new Set<string>() // IDs de paquetes en esta caja que esperan hermanos

  if (origenIds.length > 0) {
    const { data: todosHermanos } = await admin
      .from('paquetes')
      .select('id, paquete_origen_id, estado')
      .in('paquete_origen_id', origenIds)

    // Por cada origen, verificar si algún hermano falta en esta caja y no está en Colombia
    const hermanosPorOrigen = new Map<string, NonNullable<typeof todosHermanos>>()
    for (const h of todosHermanos ?? []) {
      if (!h.paquete_origen_id) continue
      if (!hermanosPorOrigen.has(h.paquete_origen_id)) hermanosPorOrigen.set(h.paquete_origen_id, [])
      hermanosPorOrigen.get(h.paquete_origen_id)!.push(h)
    }

    for (const [origenId, hermanos] of hermanosPorOrigen) {
      const hayHermanoPendienteAfuera = hermanos.some(h =>
        !idsEnEstaCaja.has(h.id) &&
        !['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(h.estado)
      )
      if (hayHermanoPendienteAfuera) {
        // Marcar todos los sub-paquetes de este origen que estén EN esta caja
        for (const p of paquetes) {
          if (p.paquete_origen_id === origenId) esperaHermanosSet.add(p.id)
        }
      }
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
        espera_hermanos: esperaHermanosSet.has(p.id),
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
    .select('id, estado, cliente_id, bodega_destino, tracking_casilla, paquete_origen_id, visible_cliente, peso_libras, peso_facturable')
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

  // ─── Actualizar la(s) caja(s) consolidacion con ese tracking_usaco ─────
  // Si todos los paquetes de la caja ya están recibidos en Colombia,
  // marcar la caja como 'recibida_colombia' con fecha de recepción.
  let cajasActualizadas = 0
  try {
    const { data: cajasMatch } = await admin
      .from('cajas_consolidacion')
      .select('id, estado')
      .ilike('tracking_usaco', trackingUsaco)

    for (const caja of cajasMatch ?? []) {
      // Verificar si todos sus paquetes ya están en estado de Colombia
      const { data: paquetesDeCaja } = await admin
        .from('paquetes')
        .select('estado')
        .eq('caja_id', caja.id)

      const todosRecibidos = paquetesDeCaja && paquetesDeCaja.length > 0 &&
        paquetesDeCaja.every(p =>
          ['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
        )

      if (todosRecibidos && caja.estado !== 'recibida_colombia') {
        await admin
          .from('cajas_consolidacion')
          .update({
            estado: 'recibida_colombia',
            fecha_recepcion_colombia: ahora,
            updated_at: ahora,
          })
          .eq('id', caja.id)
        cajasActualizadas++
      }
    }
  } catch (err) {
    console.error('[recibir-colombia] error actualizando cajas:', err)
  }

  // ─── Reunificar sub-paquetes si todos llegaron a Colombia ────────────────
  // Cuando un paquete fue dividido en sub-paquetes para logística interna,
  // al llegar todos a Colombia se vuelven a unir en el paquete original
  // sumando los pesos de todos los sub-paquetes.
  const origenesEnProceso = [...new Set(
    aProcesar
      .filter(p => p.paquete_origen_id && p.visible_cliente === false)
      .map(p => p.paquete_origen_id as string)
  )]

  // Rastrear qué padres quedaron completamente reunificados en este batch
  const origenesReunificados = new Set<string>()

  for (const origenId of origenesEnProceso) {
    // Cargar TODOS los sub-paquetes de este origen
    const { data: todosSubPaquetes } = await admin
      .from('paquetes')
      .select('id, estado, peso_libras, peso_facturable')
      .eq('paquete_origen_id', origenId)

    if (!todosSubPaquetes || todosSubPaquetes.length === 0) continue

    const todosEnColombia = todosSubPaquetes.every(sp =>
      ['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(sp.estado)
    )

    if (todosEnColombia) {
      const pesoTotal = todosSubPaquetes.reduce((sum, sp) => sum + Number(sp.peso_libras ?? 0), 0)
      const pesoFacturableTotal = todosSubPaquetes.reduce((sum, sp) => sum + Number(sp.peso_facturable ?? sp.peso_libras ?? 0), 0)

      await admin
        .from('paquetes')
        .update({
          estado: 'en_bodega_local',
          peso_libras: Math.round(pesoTotal * 100) / 100,
          peso_facturable: Math.round(pesoFacturableTotal * 100) / 100,
          fecha_llegada_colombia: ahora,
          updated_at: ahora,
          ...(body.bodega_destino ? { bodega_destino: body.bodega_destino } : {}),
        })
        .eq('id', origenId)

      await admin.from('eventos_paquete').insert({
        paquete_id: origenId,
        estado_anterior: 'en_transito',
        estado_nuevo: 'en_bodega_local',
        descripcion: `Paquete reunificado en bodega Colombia: ${todosSubPaquetes.length} sub-paquetes (${Math.round(pesoTotal * 100) / 100} lb total)`,
        ubicacion: 'Colombia',
      }).then(() => {/* ok */}, (e) => console.error('[recibir-colombia] evento reunificar:', e))

      origenesReunificados.add(origenId)
    }
  }

  // Notificar a cada cliente vía WhatsApp (con pequeño delay entre cada uno)
  // Solo paquetes visibles al cliente (no sub-paquetes internos).
  // Para padres divididos: notificar SOLO cuando todos los sub-paquetes llegaron
  // (origenesReunificados). Si solo llega una parte, el cliente no recibe nada todavía.
  let notificados = 0
  let fallidos = 0
  if (debeNotificar) {
    for (const p of aProcesar) {
      if (!p.cliente_id) continue
      if (p.visible_cliente === false) continue   // sub-paquetes: nunca notifican directo
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

    // Notificar SOLO padres completamente reunificados en este batch
    for (const origenId of origenesReunificados) {
      try {
        await notificarCambioEstado(origenId, 'en_bodega_local')
        notificados++
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        fallidos++
        console.error(`[recibir-colombia] notif origen reunificado ${origenId}:`, err)
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
    cajas_actualizadas: cajasActualizadas,
  })
}
