// POST /api/admin/tarifas/rangos — crear nueva tarifa escalonada (solo admin)

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    categoria: string
    condicion?: 'nuevo' | 'usado' | null
    min_unidades?: number
    max_unidades?: number | null
    precio_por_unidad?: number
    cargo_fijo?: number
    tarifa_por_libra?: number
    peso_minimo_facturable?: number | null
    seguro_porcentaje?: number
    valor_min?: number | null
    valor_max?: number | null
    prioridad?: number
    notas?: string | null
    activo?: boolean
  }

  if (!body.categoria) {
    return NextResponse.json({ error: 'categoria requerida' }, { status: 400 })
  }
  if (body.condicion && !['nuevo', 'usado'].includes(body.condicion)) {
    return NextResponse.json({ error: 'condicion inválida' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin.from('tarifas_rangos').insert({
    categoria: body.categoria,
    condicion: body.condicion ?? null,
    min_unidades: body.min_unidades ?? 1,
    max_unidades: body.max_unidades ?? null,
    precio_por_unidad: body.precio_por_unidad ?? 0,
    cargo_fijo: body.cargo_fijo ?? 0,
    tarifa_por_libra: body.tarifa_por_libra ?? 0,
    peso_minimo_facturable: body.peso_minimo_facturable ?? null,
    seguro_porcentaje: body.seguro_porcentaje ?? 0,
    valor_min: body.valor_min ?? null,
    valor_max: body.valor_max ?? null,
    prioridad: body.prioridad ?? 100,
    notas: body.notas ?? null,
    activo: body.activo ?? true,
  }).select('*').single()

  if (error) {
    console.error('[tarifas/rangos POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, tarifa: data })
}
