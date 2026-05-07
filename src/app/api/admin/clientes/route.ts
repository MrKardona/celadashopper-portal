// POST /api/admin/clientes
// Crea un nuevo cliente manualmente: cuenta en auth.users + perfil en la BD.
// Opcionalmente envía el magic link de bienvenida al correo del cliente.

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
  if (!limpio.startsWith('+')) {
    const sinCero = limpio.replace(/^0+/, '')
    return sinCero.startsWith('57') ? `+${sinCero}` : `+57${sinCero}`
  }
  return limpio
}

export async function POST(req: NextRequest) {
  // Verificar admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfilAdmin } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!perfilAdmin || perfilAdmin.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as {
    nombre_completo?: string
    email?: string
    whatsapp?: string | null
    telefono?: string | null
    ciudad?: string | null
    direccion?: string | null
    barrio?: string | null
    referencia?: string | null
    numero_casilla?: string | null
    enviar_link?: boolean
  }

  // Validar campos requeridos
  if (!body.nombre_completo?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }
  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  // Verificar que el email no exista ya
  const { data: existente } = await admin
    .from('perfiles').select('id').eq('email', email).maybeSingle()
  if (existente) {
    return NextResponse.json({ error: 'Ya existe un cliente con ese correo' }, { status: 409 })
  }

  // Auto-asignar número de casilla si no se provee
  let numeroCasilla = body.numero_casilla?.trim() || null
  if (!numeroCasilla) {
    const { data: maxRow } = await admin
      .from('perfiles')
      .select('numero_casilla')
      .not('numero_casilla', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    // Buscar el máximo numérico entre los últimos 50
    let maxNum = 91786
    if (maxRow) {
      for (const r of maxRow) {
        const n = parseInt(r.numero_casilla ?? '', 10)
        if (!isNaN(n) && n > maxNum) maxNum = n
      }
    }
    numeroCasilla = String(maxNum + 1)
  }

  // Verificar que la casilla no esté duplicada
  if (numeroCasilla) {
    const { data: casillaUsada } = await admin
      .from('perfiles').select('id').eq('numero_casilla', numeroCasilla).maybeSingle()
    if (casillaUsada) {
      return NextResponse.json({
        error: `La casilla ${numeroCasilla} ya está asignada a otro cliente`,
      }, { status: 409 })
    }
  }

  // 1. Crear el usuario en auth.users
  const { data: nuevoUser, error: errAuth } = await admin.auth.admin.createUser({
    email,
    email_confirm: true, // marcar como confirmado sin que tenga que verificar
  })
  if (errAuth || !nuevoUser.user) {
    console.error('[POST clientes] createUser:', errAuth)
    return NextResponse.json({
      error: errAuth?.message ?? 'No se pudo crear la cuenta de usuario',
    }, { status: 500 })
  }

  const userId = nuevoUser.user.id

  // 2. Insertar perfil en la BD
  const { error: errPerfil } = await admin.from('perfiles').insert({
    id: userId,
    nombre_completo: body.nombre_completo.trim(),
    email,
    whatsapp: normalizarTelefono(body.whatsapp),
    telefono: normalizarTelefono(body.telefono),
    ciudad: body.ciudad?.trim() || null,
    direccion: body.direccion?.trim() || null,
    barrio: body.barrio?.trim() || null,
    referencia: body.referencia?.trim() || null,
    numero_casilla: numeroCasilla,
    rol: 'cliente',
    activo: true,
  })

  if (errPerfil) {
    // Revertir: borrar el usuario de auth si el perfil falló
    await admin.auth.admin.deleteUser(userId)
    console.error('[POST clientes] insertar perfil:', errPerfil)
    return NextResponse.json({ error: errPerfil.message }, { status: 500 })
  }

  // 3. Enviar magic link de bienvenida si se solicitó
  let linkEnviado = false
  if (body.enviar_link !== false) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.celadashopper.com'
      // Usar el admin server client (ya creado) para enviar el OTP
      const { error: errOtp } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // ya existe
          emailRedirectTo: `${siteUrl}/api/auth/callback`,
        },
      })
      if (!errOtp) linkEnviado = true
      else console.warn('[POST clientes] magic link:', errOtp.message)
    } catch (e) {
      console.warn('[POST clientes] magic link excepción:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: userId,
    numero_casilla: numeroCasilla,
    link_enviado: linkEnviado,
  }, { status: 201 })
}
