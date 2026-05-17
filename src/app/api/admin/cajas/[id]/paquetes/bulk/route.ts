// POST /api/admin/cajas/[id]/paquetes/bulk — asignar múltiples paquetes a una caja en lote

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: cajaId } = await params
  const body = await req.json() as { paquete_ids?: string[] }

  if (!Array.isArray(body.paquete_ids) || body.paquete_ids.length === 0) {
    return NextResponse.json({ error: 'paquete_ids requerido' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // 1. Verificar que la caja existe
  const { data: caja } = await admin
    .from('cajas_consolidacion')
    .select('id, bodega_destino')
    .eq('id', cajaId)
    .maybeSingle()

  if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 })

  const ahora = new Date().toISOString()

  // 2. Para cada paquete: actualizar estado + insertar evento en paralelo
  await Promise.all(
    body.paquete_ids.map(async (paqueteId) => {
      await Promise.all([
        admin
          .from('paquetes')
          .update({ caja_id: cajaId, estado: 'en_consolidacion', updated_at: ahora })
          .eq('id', paqueteId),
        admin
          .from('eventos_paquete')
          .insert({
            paquete_id: paqueteId,
            estado_anterior: 'recibido_usa',
            estado_nuevo: 'en_consolidacion',
            descripcion: `Agregado a caja consolidada para ${caja.bodega_destino}`,
            ubicacion: 'Miami, USA',
          }),
      ])
    })
  )

  return NextResponse.json({ ok: true, asignados: body.paquete_ids.length })
}
