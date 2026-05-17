// POST /api/admin/clientes/crear
// Registra un cliente nuevo desde el panel de recepción admin.
// Crea el usuario en Supabase Auth + perfil + asigna número de casilla.

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
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['admin', 'agente_usa'].includes(perfil.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as {
    nombre_completo: string
    email: string
    whatsapp?: string
    telefono?: string
    ciudad?: string
  }

  const nombre = body.nombre_completo?.trim()
  const email  = body.email?.trim().toLowerCase()

  if (!nombre || !email) {
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })
  }

  // Verificar si el email ya existe en perfiles
  const { data: existente } = await admin
    .from('perfiles')
    .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
    .eq('email', email)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({
      error: 'Este email ya tiene una cuenta registrada',
      cliente: existente,
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

  // Crear usuario en Supabase Auth (sin contraseña — el cliente la configura con magic link)
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
      telefono: body.telefono?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      numero_casilla: numeroCasilla,
      rol: 'cliente',
      activo: true,
    })
    .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
    .single()

  if (perfilErr || !nuevoPerfil) {
    // Rollback: eliminar auth user creado
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: perfilErr?.message ?? 'Error creando perfil' }, { status: 500 })
  }

  // Enviar magic link para que el cliente configure su contraseña
  try {
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.celadashopper.com'}/mi-cuenta` },
    })
  } catch {
    // No es crítico — el cliente puede usar "olvidé mi contraseña" después
  }

  return NextResponse.json({ ok: true, cliente: nuevoPerfil, numero_casilla: numeroCasilla })
}
