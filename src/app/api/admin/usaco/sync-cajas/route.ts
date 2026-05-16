// POST /api/admin/usaco/sync-cajas
// Consulta USACO y actualiza el estado de las cajas despachadas.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { consultarGuias } from '@/lib/usaco/cliente'

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

const IGNORAR_SIEMPRE = new Set(['RecibidoOrigen', 'IncluidoEnGuia', 'Pre-Alertado'])

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // 1. Cajas despachadas con tracking USACO
  const { data: cajas, error } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, estado_usaco')
    .eq('estado', 'despachada')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: 0,
      actualizadas: 0,
      mensaje: 'No hay cajas despachadas con tracking USACO',
    })
  }

  // 2. Consultar USACO (guías únicas)
  const trackingsUnicos = [...new Set(cajas.map(c => (c.tracking_usaco as string).trim()))]
  const resultados = await consultarGuias(trackingsUnicos)

  if (resultados.length === 0) {
    return NextResponse.json({
      ok: true,
      consultadas: cajas.length,
      actualizadas: 0,
      mensaje: 'USACO no devolvió resultados',
    })
  }

  const norm = (g: string) => g.trim().replace(/^0+/, '') || '0'

  const estadoMap = new Map(
    resultados
      .filter(r => r.estado && !r.estado.toLowerCase().includes('no se encontró'))
      .map(r => [norm(r.guia), r.estado.trim()])
  )

  const ahora = new Date().toISOString()
  let actualizadas = 0

  for (const caja of cajas) {
    const tracking = norm(caja.tracking_usaco as string)
    const estadoUsaco = estadoMap.get(tracking)

    if (!estadoUsaco || IGNORAR_SIEMPRE.has(estadoUsaco)) continue

    const huboCambio = estadoUsaco !== caja.estado_usaco

    const { error: errCaja } = await admin
      .from('cajas_consolidacion')
      .update({ estado_usaco: estadoUsaco, usaco_sync_at: ahora })
      .eq('id', caja.id)

    if (!errCaja && huboCambio) actualizadas++
  }

  return NextResponse.json({ ok: true, consultadas: cajas.length, actualizadas })
}
