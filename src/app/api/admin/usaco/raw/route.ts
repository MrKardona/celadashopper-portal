// GET /api/admin/usaco/raw?guia=46626
// Devuelve la respuesta RAW completa de USACO para ver todos los campos

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const USACO_URL = 'https://apiserviceusaco.uc.r.appspot.com/usaco/agencia-paqueteria/'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const guia = request.nextUrl.searchParams.get('guia')
  if (!guia) return NextResponse.json({ error: 'Falta ?guia=...' }, { status: 400 })

  const norm = (g: string) => g.trim().replace(/^0+/, '') || '0'
  const guiaNorm = norm(guia)

  const res = await fetch(USACO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.USACO_API_KEY ?? '',
    },
    body: JSON.stringify({
      agency_password: process.env.USACO_PASSWORD ?? '',
      type: 'guias',
      info: [guiaNorm],
    }),
    signal: AbortSignal.timeout(15_000),
  })

  const raw = await res.json()
  return NextResponse.json({ guia_enviada: guiaNorm, http_status: res.status, raw })
}
