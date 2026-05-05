// src/app/api/admin/recibir/route.ts
// GET  /api/admin/recibir?tracking=XXX  → buscar paquete por tracking
// POST /api/admin/recibir               → marcar como recibido en USA

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (perfil?.rol !== 'admin') return null
  return user
}

async function guardarFoto(
  admin: ReturnType<typeof getSupabaseAdmin>,
  paquete_id: string,
  foto_url: string,
  descripcion = 'Foto recepción bodega Miami',
) {
  await admin.from('fotos_paquetes').insert({
    paquete_id,
    url: foto_url,
    storage_path: foto_url,
    descripcion,
  })
}

// GET: buscar paquete por tracking para previsualizar
export async function GET(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tracking = req.nextUrl.searchParams.get('tracking')?.trim()
  if (!tracking) return NextResponse.json({ error: 'tracking requerido' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Query principal SIN embed para evitar problemas de PostgREST/RLS
  const { data: paquetes, error: queryErr } = await admin
    .from('paquetes')
    .select(`
      id, tracking_casilla, tracking_origen, tracking_usaco,
      descripcion, tienda, categoria, estado, cliente_id,
      peso_libras, peso_facturable, valor_declarado,
      fecha_recepcion_usa, notas_cliente, bodega_destino
    `)
    .or(`tracking_casilla.ilike.%${tracking}%,tracking_origen.ilike.%${tracking}%`)
    .limit(5)

  if (queryErr) {
    console.error('[admin/recibir GET]', queryErr)
    return NextResponse.json({ error: queryErr.message }, { status: 500 })
  }

  // Si NO se encontró paquete, intentar buscar como cliente:
  // por número de casillero, nombre, email, whatsapp o teléfono.
  // Esto ayuda al agente USA: si escribió un CS-XXXX o el nombre del cliente,
  // le devolvemos la lista de coincidencias para que pueda arrancar el modo
  // manual con el cliente preseleccionado.
  if (!paquetes || paquetes.length === 0) {
    const term = `%${tracking}%`
    const { data: clientes } = await admin
      .from('perfiles')
      .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
      .eq('rol', 'cliente')
      .or(
        `nombre_completo.ilike.${term},email.ilike.${term},numero_casilla.ilike.${term},whatsapp.ilike.${term},telefono.ilike.${term}`
      )
      .limit(5)

    if (clientes && clientes.length > 0) {
      return NextResponse.json({
        error: 'Paquete no encontrado',
        clientes,
      }, { status: 404 })
    }

    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  // Buscar coincidencia exacta o usar la primera
  const exacto = paquetes.find(
    p =>
      p.tracking_casilla?.toLowerCase() === tracking.toLowerCase() ||
      p.tracking_origen?.toLowerCase() === tracking.toLowerCase()
  )
  const elegido = exacto ?? paquetes[0]

  // Cargar perfil del cliente por separado si existe
  let perfiles = null
  if (elegido.cliente_id) {
    const { data: perfilData } = await admin
      .from('perfiles')
      .select('nombre_completo, numero_casilla, whatsapp, telefono')
      .eq('id', elegido.cliente_id)
      .maybeSingle()
    perfiles = perfilData
  }

  return NextResponse.json({ paquete: { ...elegido, perfiles } })
}

// POST: registrar recepción en bodega USA
// Soporta dos modos:
//   A) paquete_id → actualizar paquete existente ya encontrado
//   B) sin_asignar: true → crear paquete nuevo sin cliente_id
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    // Modo A: paquete existente
    paquete_id?: string
    peso_libras?: number
    tracking_usaco?: string
    notas_internas?: string
    // Modo B: sin asignar (puede traer cliente_id si el agente lo identificó)
    sin_asignar?: boolean
    descripcion?: string
    tienda?: string
    tracking_origen?: string
    categoria?: string
    bodega_destino?: string
    cliente_id?: string | null  // ← opcional: si el agente asignó cliente desde el form manual
    // Ambos modos
    foto_url?: string
    foto2_url?: string
  }

  const admin = getSupabaseAdmin()

  // ── MODO B: Crear paquete sin cliente (con detección de duplicados) ─────
  // Nota: aunque el flag se llame sin_asignar, el agente puede haber identificado
  // al cliente y pasarlo en body.cliente_id. En ese caso el paquete se crea/asigna
  // directamente al cliente y se le notifica.
  if (body.sin_asignar) {
    const { descripcion, tienda, tracking_origen, categoria, bodega_destino, notas_internas, foto_url } = body
    const peso_libras = body.peso_libras
    const trackingOrigenLimpio = tracking_origen?.trim() || null
    const clienteIdManual = body.cliente_id?.trim() || null

    if (!descripcion || !peso_libras || peso_libras <= 0 || !categoria) {
      return NextResponse.json({ error: 'descripcion, peso y categoria son requeridos' }, { status: 400 })
    }

    // Validar que el cliente existe si fue proporcionado
    if (clienteIdManual) {
      const { data: clienteCheck } = await admin
        .from('perfiles')
        .select('id, rol')
        .eq('id', clienteIdManual)
        .maybeSingle()
      if (!clienteCheck) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }
      if (clienteCheck.rol !== 'cliente') {
        return NextResponse.json({ error: 'El usuario seleccionado no es un cliente' }, { status: 400 })
      }
    }

    // ─ Antes de crear, buscar si ya existe paquete con ese tracking_origen ─
    if (trackingOrigenLimpio) {
      const { data: existente } = await admin
        .from('paquetes')
        .select('id, tracking_casilla, cliente_id, estado, descripcion')
        .ilike('tracking_origen', trackingOrigenLimpio)
        .limit(1)
        .maybeSingle()

      if (existente) {
        // ¡Ya existe! Actualizar en lugar de duplicar
        const updates: Record<string, unknown> = {
          estado: 'recibido_usa',
          peso_libras,
          fecha_recepcion_usa: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        // Si el paquete del cliente no tenía tienda/categoria, completar con lo del admin
        if (tienda) updates.tienda = tienda
        if (categoria) updates.categoria = categoria
        if (bodega_destino) updates.bodega_destino = bodega_destino
        // Si el agente identificó al cliente y el paquete no tenía cliente_id, asignarlo
        if (clienteIdManual && !existente.cliente_id) updates.cliente_id = clienteIdManual

        const { error: updErr } = await admin
          .from('paquetes')
          .update(updates)
          .eq('id', existente.id)

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

        if (foto_url) await guardarFoto(admin, existente.id, foto_url, 'Empaque con guía de envío')
        if (body.foto2_url) await guardarFoto(admin, existente.id, body.foto2_url, 'Contenido del paquete (revisión)')

        await admin.from('eventos_paquete').insert({
          paquete_id: existente.id,
          estado_anterior: existente.estado,
          estado_nuevo: 'recibido_usa',
          descripcion: existente.cliente_id
            ? `Match automático: paquete ya reportado por cliente. ${notas_internas ?? ''}`.trim()
            : `Match automático: paquete sin asignar previo actualizado. ${notas_internas ?? ''}`.trim(),
          ubicacion: 'Miami, USA',
        })

        // Si tenía cliente (o se asignó ahora), notificar (Meta directo con fotos)
        const clienteFinal = existente.cliente_id ?? clienteIdManual
        if (clienteFinal) {
          try {
            await notificarCambioEstado(existente.id, 'recibido_usa')
          } catch (err) {
            console.error('[recibir match] notificación:', err)
          }
        }

        return NextResponse.json({
          ok: true,
          tracking_casilla: existente.tracking_casilla,
          fusionado: true,
          tenia_cliente: !!existente.cliente_id,
        })
      }
    }

    // ─ No hay duplicado: crear paquete nuevo (con o sin cliente) ─
    const { data: nuevo, error: insertErr } = await admin
      .from('paquetes')
      .insert({
        cliente_id: clienteIdManual,
        tienda: tienda ?? 'Sin especificar',
        descripcion,
        categoria,
        bodega_destino: bodega_destino ?? 'medellin',
        tracking_origen: trackingOrigenLimpio,
        peso_libras,
        estado: 'recibido_usa',
        fecha_recepcion_usa: new Date().toISOString(),
        factura_pagada: false,
      })
      .select('id, tracking_casilla')
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Guardar fotos si existen
    if (foto_url) {
      await guardarFoto(admin, nuevo.id, foto_url, 'Empaque con guía de envío')
    }
    if (body.foto2_url) {
      await guardarFoto(admin, nuevo.id, body.foto2_url, 'Contenido del paquete (revisión)')
    }

    // Registrar evento
    await admin.from('eventos_paquete').insert({
      paquete_id: nuevo.id,
      estado_anterior: null,
      estado_nuevo: 'recibido_usa',
      descripcion: clienteIdManual
        ? (notas_internas
            ? `Recibido y asignado al cliente desde recepción. ${notas_internas}`
            : 'Recibido en bodega USA — asignado al cliente desde recepción')
        : (notas_internas
            ? `Recibido sin asignar. ${notas_internas}`
            : 'Recibido en bodega USA — sin cliente asignado'),
      ubicacion: 'Miami, USA',
    })

    // Si el agente identificó al cliente, notificar (foto incluida si existe)
    if (clienteIdManual) {
      try {
        await notificarCambioEstado(nuevo.id, 'recibido_usa')
      } catch (err) {
        console.error('[recibir manual] notificación:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      tracking_casilla: nuevo.tracking_casilla,
      fusionado: false,
      asignado: !!clienteIdManual,
    })
  }

  // ── MODO A: Actualizar paquete existente ────────────────────────────────
  const { paquete_id, peso_libras, tracking_usaco, notas_internas, foto_url, foto2_url } = body

  if (!paquete_id || !peso_libras || peso_libras <= 0) {
    return NextResponse.json({ error: 'paquete_id y peso_libras son requeridos' }, { status: 400 })
  }

  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, estado, tracking_casilla')
    .eq('id', paquete_id)
    .single()

  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

  const estadoAnterior = paquete.estado
  const updates: Record<string, unknown> = {
    estado: 'recibido_usa',
    peso_libras,
    fecha_recepcion_usa: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (tracking_usaco) updates.tracking_usaco = tracking_usaco

  const { error: updateError } = await admin.from('paquetes').update(updates).eq('id', paquete_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Guardar fotos si existen
  if (foto_url) {
    await guardarFoto(admin, paquete_id, foto_url, 'Empaque con guía de envío')
  }
  if (foto2_url) {
    await guardarFoto(admin, paquete_id, foto2_url, 'Contenido del paquete (revisión)')
  }

  await admin.from('eventos_paquete').insert({
    paquete_id,
    estado_anterior: estadoAnterior,
    estado_nuevo: 'recibido_usa',
    descripcion: notas_internas
      ? `Recibido en bodega USA. ${notas_internas}`
      : 'Recibido en bodega USA',
    ubicacion: 'Miami, USA',
  })

  // Auditoría incondicional: confirma que el endpoint llegó hasta este punto
  const { data: pq } = await admin
    .from('paquetes')
    .select('cliente_id')
    .eq('id', paquete_id)
    .maybeSingle()

  await admin.from('notificaciones').insert({
    cliente_id: pq?.cliente_id ?? null,
    paquete_id,
    tipo: 'recibir_audit',
    titulo: `[AUDIT] /admin/recibir modo A ejecutado: ${estadoAnterior} → recibido_usa`,
    mensaje: `Endpoint llegó hasta notificarCambioEstado. Peso: ${peso_libras} lbs.`,
    enviada_whatsapp: false,
  }).then(() => {/* ok */}, (e) => console.error('[recibir audit]', e))

  // Notificar WhatsApp al cliente (con fotos si las hay)
  try {
    await notificarCambioEstado(paquete_id, 'recibido_usa')
  } catch (err) {
    console.error('[recibir modo A] notificación:', err)
  }

  return NextResponse.json({ ok: true, tracking: paquete.tracking_casilla })
}
