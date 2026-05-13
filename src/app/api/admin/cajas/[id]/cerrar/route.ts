// POST /api/admin/cajas/[id]/cerrar
// Cierra la caja: ya no se puede modificar el contenido. Los paquetes pasan a 'listo_envio'.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { peso_estimado?: number }
  const admin = getSupabaseAdmin()

  // Verificar caja abierta con paquetes adentro
  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('id, estado')
    .eq('id', id)
    .maybeSingle()
  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })
  if (caja.estado !== 'abierta') {
    return NextResponse.json({ error: 'Solo se pueden cerrar cajas abiertas' }, { status: 400 })
  }

  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, peso_libras')
    .eq('caja_id', id)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'La caja está vacía' }, { status: 400 })
  }

  // Calcular peso estimado si no viene
  const pesoEstimado = body.peso_estimado ??
    paquetes.reduce((s, p) => s + Number(p.peso_libras ?? 0), 0)

  const ahora = new Date().toISOString()

  // Actualizar caja
  await admin
    .from('cajas_consolidacion')
    .update({
      estado: 'cerrada',
      peso_estimado: pesoEstimado,
      fecha_cierre: ahora,
      updated_at: ahora,
    })
    .eq('id', id)

  // Pasar todos los paquetes a 'listo_envio'
  await admin
    .from('paquetes')
    .update({ estado: 'listo_envio', updated_at: ahora })
    .eq('caja_id', id)

  // Eventos
  const eventos = paquetes.map(p => ({
    paquete_id: p.id,
    estado_anterior: 'en_consolidacion',
    estado_nuevo: 'listo_envio',
    descripcion: 'Caja cerrada, listo para entregar a USACO',
    ubicacion: 'Miami, USA',
  }))
  await admin.from('eventos_paquete').insert(eventos)
    .then(() => {/* ok */}, (e) => console.error('[caja cerrar] eventos:', e))

  return NextResponse.json({
    ok: true,
    paquetes: paquetes.length,
    peso_estimado: pesoEstimado,
  })
}
