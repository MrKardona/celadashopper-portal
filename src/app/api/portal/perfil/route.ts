// PATCH /api/portal/perfil — actualiza datos editables del cliente autenticado

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizarTelefono(raw: string | null | undefined): string | null {
  if (!raw) return null
  const limpio = raw.replace(/[^\d+]/g, '').trim()
  if (!limpio) return null
  // Si no empieza con +, asumimos Colombia (+57)
  if (!limpio.startsWith('+')) {
    const sinCero = limpio.replace(/^0+/, '')
    return sinCero.startsWith('57') ? `+${sinCero}` : `+57${sinCero}`
  }
  return limpio
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    nombre_completo?: string
    telefono?: string
    whatsapp?: string
    ciudad?: string
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.nombre_completo === 'string' && body.nombre_completo.trim()) {
    updates.nombre_completo = body.nombre_completo.trim()
  }
  if (typeof body.telefono === 'string') {
    updates.telefono = normalizarTelefono(body.telefono)
  }
  if (typeof body.whatsapp === 'string') {
    updates.whatsapp = normalizarTelefono(body.whatsapp)
  }
  if (typeof body.ciudad === 'string') {
    updates.ciudad = body.ciudad.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('perfiles').update(updates).eq('id', user.id)

  if (error) {
    console.error('[portal/perfil PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
