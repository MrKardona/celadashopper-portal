// POST /api/auth/registro
// Registro público de cliente nuevo desde la pantalla de login.
// No requiere autenticación — cualquier persona puede auto-registrarse.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    nombre_completo: string
    email: string
    whatsapp?: string
    ciudad?: string
  }

  const nombre = body.nombre_completo?.trim()
  const email  = body.email?.trim().toLowerCase()

  if (!nombre || !email) {
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
  }

  const admin = getAdmin()

  // Verificar si el email ya existe en perfiles
  const { data: existente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, numero_casilla')
    .eq('email', email)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({
      error: 'Este email ya tiene una cuenta registrada',
      ya_existe: true,
    }, { status: 409 })
  }

  // Calcular siguiente número de casilla (CS-XXXX)
  const { data: maxRow } = await admin
    .from('perfiles')
    .select('numero_casilla')
    .like('numero_casilla', 'CS-%')
    .order('numero_casilla', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1001
  if (maxRow?.numero_casilla) {
    const parsed = parseInt((maxRow.numero_casilla as string).replace('CS-', ''), 10)
    if (!isNaN(parsed)) nextNum = parsed + 1
  }
  const numeroCasilla = `CS-${nextNum}`

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Error creando el usuario' }, { status: 500 })
  }

  // Crear perfil
  const { data: nuevoPerfil, error: perfilErr } = await admin
    .from('perfiles')
    .insert({
      id: authData.user.id,
      nombre_completo: nombre,
      email,
      whatsapp: body.whatsapp?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      numero_casilla: numeroCasilla,
      rol: 'cliente',
      activo: true,
    })
    .select('id, nombre_completo, email, numero_casilla')
    .single()

  if (perfilErr || !nuevoPerfil) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: perfilErr?.message ?? 'Error creando perfil' }, { status: 500 })
  }

  // Enviar magic link para que el cliente acceda de inmediato
  const headersList = await headers()
  const origin =
    headersList.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://portal.celadashopper.com'

  try {
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/api/auth/callback` },
    })
  } catch {
    // No crítico
  }

  // Intentar enviar magic link via OTP para que llegue al correo
  try {
    const supabasePublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabasePublic.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/api/auth/callback`,
      },
    })
  } catch {
    // No crítico — el usuario puede pedir el link después
  }

  return NextResponse.json({
    ok: true,
    numero_casilla: numeroCasilla,
    nombre_completo: nuevoPerfil.nombre_completo,
    email: nuevoPerfil.email,
  })
}
