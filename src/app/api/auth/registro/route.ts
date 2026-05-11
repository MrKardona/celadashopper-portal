// POST /api/auth/registro
// Registro público de cliente nuevo desde la pantalla de login.

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

  // ── 1. ¿Ya existe el perfil? (case-insensitive) ──────────────────────────
  const { data: perfilExistente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, numero_casilla')
    .ilike('email', email)
    .maybeSingle()

  if (perfilExistente) {
    return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
  }

  // ── 2. Calcular siguiente casillero ──────────────────────────────────────
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

  // ── 3. Crear usuario en Auth ─────────────────────────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  })

  // Si el auth user ya existe pero no tiene perfil, obtenemos el ID via SQL
  let userId: string | null = null

  if (authError) {
    const msgLower = authError.message.toLowerCase()
    const yaExisteEnAuth =
      msgLower.includes('already been registered') ||
      msgLower.includes('already exists') ||
      msgLower.includes('already registered') ||
      msgLower.includes('duplicate')

    if (yaExisteEnAuth) {
      // Buscar el ID del auth user via tabla auth.users usando service role
      const { data: authUser } = await admin
        .from('perfiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()

      if (authUser) {
        // El perfil SÍ existe (race condition con la check anterior)
        return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
      }

      // Auth user existe sin perfil — no podemos obtener su ID fácilmente.
      // Devolver un error amigable para que el usuario contacte soporte.
      return NextResponse.json({
        error: 'Esta cuenta ya existe en nuestro sistema pero necesita activación. Contacta a Celada Shopper para completar tu registro.',
        ya_existe: false,
      }, { status: 422 })
    }

    return NextResponse.json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }

  if (!authData?.user) {
    return NextResponse.json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }
  userId = authData.user.id

  // ── 4. Crear perfil ─────────────────────────────────────────────────────
  const { data: nuevoPerfil, error: perfilErr } = await admin
    .from('perfiles')
    .insert({
      id: userId,
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
    // duplicate key → el perfil ya existe a pesar del check inicial (race condition)
    if (perfilErr?.code === '23505') {
      return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
    }
    // Rollback auth user
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: 'Error creando el perfil. Intenta de nuevo.' }, { status: 500 })
  }

  // ── 5. Enviar magic link de bienvenida ───────────────────────────────────
  const headersList = await headers()
  const origin =
    headersList.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://portal.celadashopper.com'

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
    // No crítico — el usuario puede solicitar el link desde el login
  }

  return NextResponse.json({
    ok: true,
    numero_casilla: numeroCasilla,
    nombre_completo: nuevoPerfil.nombre_completo,
    email: nuevoPerfil.email,
  })
}
