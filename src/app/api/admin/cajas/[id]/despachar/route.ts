// POST /api/admin/cajas/[id]/despachar
// Despacha la caja: pega tracking USACO + peso real + costo. Paquetes pasan a 'en_transito'.
// Notifica a cada cliente vía WhatsApp.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'
import { insertarEventoTracking } from '@/lib/usaco/tracking'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    tracking_usaco: string
    peso_real?: number
    costo_total_usaco?: number
    courier?: string
    notificar?: boolean
  }

  const trackingUsaco = body.tracking_usaco?.trim()
  if (!trackingUsaco) return NextResponse.json({ error: 'tracking_usaco requerido' }, { status: 400 })

  const debeNotificar = body.notificar !== false
  const admin = getSupabaseAdmin()

  // Verificar caja cerrada (o abierta — permitimos saltar el cierre)
  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('id, estado, codigo_interno')
    .eq('id', id)
    .maybeSingle()
  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  if (caja.estado === 'despachada' || caja.estado === 'recibida_colombia') {
    return NextResponse.json({ error: 'Esta caja ya fue despachada' }, { status: 400 })
  }

  const ahora = new Date().toISOString()

  // Actualizar caja
  const { error: errCaja } = await admin
    .from('cajas_consolidacion')
    .update({
      tracking_usaco: trackingUsaco,
      peso_real: body.peso_real ?? null,
      costo_total_usaco: body.costo_total_usaco ?? null,
      courier: body.courier ?? null,
      estado: 'despachada',
      fecha_despacho: ahora,
      // Si está abierta y no se cerró, también marcar fecha_cierre
      fecha_cierre: caja.estado === 'abierta' ? ahora : undefined,
      updated_at: ahora,
    })
    .eq('id', id)

  if (errCaja) return NextResponse.json({ error: errCaja.message }, { status: 500 })

  // Cargar paquetes para actualizar
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, estado, cliente_id')
    .eq('caja_id', id)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ ok: true, paquetes: 0, notificados: 0 })
  }

  // Actualizar todos los paquetes: estado 'en_transito' y heredar tracking_usaco
  await admin
    .from('paquetes')
    .update({
      estado: 'en_transito',
      tracking_usaco: trackingUsaco,
      updated_at: ahora,
    })
    .eq('caja_id', id)

  // Eventos
  const eventos = paquetes.map(p => ({
    paquete_id: p.id,
    estado_anterior: p.estado,
    estado_nuevo: 'en_transito',
    descripcion: `Despachado a Colombia con USACO ${trackingUsaco} (caja ${caja.codigo_interno})`,
    ubicacion: 'Miami, USA',
  }))
  await admin.from('eventos_paquete').insert(eventos)
    .then(() => {/* ok */}, (e) => console.error('[caja despachar] eventos:', e))

  // Notificar WhatsApp + email a cada cliente e insertar evento transito_internacional
  // El evento se inserta siempre (con o sin notificación) para que el cron USACO
  // lo vea ya existente y no envíe una alerta duplicada de tránsito.
  let notificados = 0
  let fallidos = 0
  for (const p of paquetes) {
    if (!p.cliente_id) continue
    // Marcar en timeline que entró en tránsito internacional (previene dupl. del cron)
    await insertarEventoTracking(admin, p.id, 'transito_internacional', 'celada',
      `Caja ${caja.codigo_interno} despachada a Colombia`)
    if (debeNotificar) {
      try {
        await notificarCambioEstado(p.id, 'en_transito')
        notificados++
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        fallidos++
        console.error(`[caja despachar] notif ${p.id}:`, err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    paquetes: paquetes.length,
    notificados,
    fallidos,
    tracking_usaco: trackingUsaco,
  })
}
