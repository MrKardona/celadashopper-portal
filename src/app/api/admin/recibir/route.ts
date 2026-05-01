// src/app/api/admin/recibir/route.ts
// GET  /api/admin/recibir?tracking=XXX  → buscar paquete por tracking
// POST /api/admin/recibir               → marcar como recibido en USA

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createClient()
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

// GET: buscar paquete por tracking para previsualizar
export async function GET(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tracking = req.nextUrl.searchParams.get('tracking')?.trim()
  if (!tracking) return NextResponse.json({ error: 'tracking requerido' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Buscar por tracking_casilla o tracking_origen (case-insensitive)
  const { data: paquetes } = await admin
    .from('paquetes')
    .select(`
      id, tracking_casilla, tracking_origen, tracking_usaco,
      descripcion, tienda, categoria, estado,
      peso_libras, peso_facturable, valor_declarado,
      fecha_recepcion_usa, notas_cliente, bodega_destino,
      perfiles(nombre_completo, numero_casilla, whatsapp, telefono)
    `)
    .or(`tracking_casilla.ilike.%${tracking}%,tracking_origen.ilike.%${tracking}%`)
    .limit(5)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  // Preferir coincidencia exacta
  const exacto = paquetes.find(
    p =>
      p.tracking_casilla?.toLowerCase() === tracking.toLowerCase() ||
      p.tracking_origen?.toLowerCase() === tracking.toLowerCase()
  )

  return NextResponse.json({ paquete: exacto ?? paquetes[0] })
}

// POST: registrar recepción en bodega USA
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    paquete_id: string
    peso_libras: number
    tracking_usaco?: string
    notas_internas?: string
  }

  const { paquete_id, peso_libras, tracking_usaco, notas_internas } = body

  if (!paquete_id || !peso_libras || peso_libras <= 0) {
    return NextResponse.json({ error: 'paquete_id y peso_libras son requeridos' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verificar que el paquete existe y obtener estado actual
  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado, tracking_casilla, perfiles(nombre_completo)')
    .eq('id', paquete_id)
    .single()

  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

  const estadoAnterior = paquete.estado

  // Actualizar paquete
  const updates: Record<string, unknown> = {
    estado: 'recibido_usa',
    peso_libras,
    fecha_recepcion_usa: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (tracking_usaco) updates.tracking_usaco = tracking_usaco

  const { error: updateError } = await admin
    .from('paquetes')
    .update(updates)
    .eq('id', paquete_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Registrar evento de cambio de estado
  await admin.from('eventos_paquete').insert({
    paquete_id,
    estado_anterior: estadoAnterior,
    estado_nuevo: 'recibido_usa',
    descripcion: notas_internas
      ? `Recibido en bodega USA. ${notas_internas}`
      : 'Recibido en bodega USA',
    ubicacion: 'Miami, USA',
  })

  return NextResponse.json({
    ok: true,
    tracking: paquete.tracking_casilla,
  })
}
