// POST /api/auth/check-email
// Verifica si un email está registrado en perfiles. Devuelve { existe: boolean }.
//
// ⚠️  Nota de seguridad: este endpoint expone si un email está registrado o no
// (user enumeration). Decisión de producto para mejorar UX en el flujo de
// recuperación de contraseña. Está protegido contra abuso con rate limiting.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rate-limit'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  if (isRateLimited(`check-email:${ip}`)) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Intenta en un momento.' },
      { status: 429 },
    )
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('perfiles')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[check-email] Error:', error.message)
    return NextResponse.json({ error: 'Error al verificar' }, { status: 500 })
  }

  return NextResponse.json({ existe: !!data })
}
