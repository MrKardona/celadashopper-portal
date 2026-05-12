// POST /api/admin/domiciliarios/asignar-rol
// Busca un perfil por email y le asigna rol = 'domiciliario'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Verificar que el llamador sea admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const body = await req.json() as { email?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  // Buscar perfil por email
  const { data: objetivo } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, whatsapp, telefono, rol, activo')
    .ilike('email', email)
    .single()

  if (!objetivo) {
    return NextResponse.json(
      { error: 'No se encontró ningún usuario con ese correo. Debe estar registrado en el casillero.' },
      { status: 404 }
    )
  }

  if (objetivo.rol === 'domiciliario') {
    return NextResponse.json(
      { error: 'Este usuario ya tiene el rol de domiciliario.', perfil: objetivo },
      { status: 409 }
    )
  }

  // Asignar rol
  const { error: updateError } = await admin
    .from('perfiles')
    .update({ rol: 'domiciliario', activo: true })
    .eq('id', objetivo.id)

  if (updateError) {
    console.error('[asignar-rol domiciliario]', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, perfil: { ...objetivo, rol: 'domiciliario' } })
}

// GET — solo previsualizar el perfil sin cambiar nada
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getAdmin()
  const { data: callerPerfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (callerPerfil?.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const { data: objetivo } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, whatsapp, telefono, rol, activo')
    .ilike('email', email)
    .single()

  if (!objetivo) {
    return NextResponse.json(
      { error: 'No se encontró ningún usuario con ese correo.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ perfil: objetivo })
}
