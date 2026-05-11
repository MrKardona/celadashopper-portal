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

  // ── 1. Verificar si el perfil ya existe (case-insensitive) ──────────────
  const { data: perfilExistente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, numero_casilla')
    .ilike('email', email)
    .maybeSingle()

  if (perfilExistente) {
    return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
  }

  // ── 2. Verificar si el usuario ya existe en Auth (sin perfil) ───────────
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authExistente = authList?.users?.find(u => u.email?.toLowerCase() === email)

  let userId: string

  if (authExistente) {
    // Auth user existe pero no tiene perfil — usamos su ID directamente
    userId = authExistente.id
  } else {
    // ── 3. Crear usuario nuevo en Supabase Auth ───────────────────────────
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nombre_completo: nombre },
    })

    if (authError || !authData.user) {
      // Si ya existe (race condition), buscar por email de nuevo
      if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
        return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
      }
      return NextResponse.json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' }, { status: 500 })
    }
    userId = authData.user.id
  }

  // ── 4. Calcular siguiente número de casilla (CS-XXXX) ──────────────────
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

  // ── 5. Crear perfil ─────────────────────────────────────────────────────
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
    // Si es duplicate key en perfiles, el perfil ya existe — tratar como ya_existe
    if (perfilErr?.code === '23505') {
      return NextResponse.json({ error: 'Este email ya tiene una cuenta registrada', ya_existe: true }, { status: 409 })
    }
    // Solo eliminar auth user si lo creamos nosotros (no si ya existía)
    if (!authExistente) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
    }
    return NextResponse.json({ error: 'Error creando el perfil. Intenta de nuevo.' }, { status: 500 })
  }

  // ── 6. Enviar magic link de acceso ──────────────────────────────────────
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
    // No crítico — el usuario puede solicitar el link desde el login después
  }

  return NextResponse.json({
    ok: true,
    numero_casilla: numeroCasilla,
    nombre_completo: nuevoPerfil.nombre_completo,
    email: nuevoPerfil.email,
  })
}
