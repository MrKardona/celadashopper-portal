// POST /api/portal/cotizar
// Cliente loggueado consulta el costo estimado al reportar un paquete.
// Body: { categoria, condicion?, cantidad?, valor_declarado?, peso_libras? }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularTarifa } from '@/lib/tarifas/calcular'

export async function POST(req: NextRequest) {
  // Solo usuarios autenticados (cliente o admin)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: {
    categoria?: string
    condicion?: 'nuevo' | 'usado' | null
    cantidad?: number
    peso_libras?: number
    valor_declarado?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.categoria) {
    return NextResponse.json({ error: 'categoria requerida' }, { status: 400 })
  }

  const resultado = await calcularTarifa({
    categoria: body.categoria,
    condicion: body.condicion ?? null,
    cantidad: body.cantidad ?? 1,
    peso_libras: body.peso_libras ?? null,
    valor_declarado: body.valor_declarado ?? null,
  })

  if (!resultado) {
    return NextResponse.json({ error: 'No se pudo calcular' }, { status: 500 })
  }

  return NextResponse.json(resultado)
}
