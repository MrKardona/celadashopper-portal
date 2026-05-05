// GET /api/admin/clientes/buscar?q=texto
// Devuelve hasta 10 clientes que coincidan con nombre, email, casilla o teléfono.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfilAdmin } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfilAdmin || !['admin', 'agente_usa'].includes(perfilAdmin.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  // Conteo total para mostrar al admin
  const { count: totalClientes } = await admin
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .eq('rol', 'cliente')

  let query = admin
    .from('perfiles')
    .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
    .eq('rol', 'cliente')
    .order('nombre_completo')
    .limit(50)

  if (q.length > 0) {
    // Buscar en nombre, email, casilla, teléfono o whatsapp
    const term = `%${q}%`
    query = query.or(
      `nombre_completo.ilike.${term},email.ilike.${term},numero_casilla.ilike.${term},whatsapp.ilike.${term},telefono.ilike.${term}`
    )
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    clientes: data ?? [],
    total: totalClientes ?? 0,
    mostrando: data?.length ?? 0,
  })
}
