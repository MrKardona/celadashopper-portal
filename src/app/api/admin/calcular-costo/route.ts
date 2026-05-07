// POST /api/admin/calcular-costo
// Calcula el costo de servicio usando calcularTarifa (nuevo sistema tarifas_rangos + fallback legacy).
// Solo admin. Retorna el resultado completo + peso_facturable con peso_minimo aplicado.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { calcularTarifa } from '@/lib/tarifas/calcular'

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
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: {
    categoria?: string
    condicion?: 'nuevo' | 'usado' | null
    cantidad?: number
    peso_libras?: number | null
    valor_declarado?: number | null
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
    return NextResponse.json({ error: 'No se pudo calcular tarifa para esta categoría' }, { status: 422 })
  }

  // Aplicar peso_minimo_facturable de la regla al peso real
  const pesoLibras = body.peso_libras ?? null
  const pesoFacturable =
    pesoLibras !== null && resultado.peso_minimo
      ? Math.max(pesoLibras, resultado.peso_minimo)
      : pesoLibras

  return NextResponse.json({ ...resultado, peso_facturable: pesoFacturable })
}
