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

  const { data: paquetes } = await admin
    .from('paquetes')
    .select(`
      id, tracking_casilla, tracking_origen, tracking_usaco,
      descripcion, tienda, categoria, estado,
      peso_libras, peso_facturable, valor_declarado,
      fecha_recepcion_usa, notas_cliente, bodega_destino,
      perfiles(nombre_completo, numero_casilla, whatsapp, telefono)
    `)
    .or(`tracking_casilla.ilike.%${tracking}%,tracking_origen.ilike.%${tracking}%`)
    .limit(5)

  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  const exacto = paquetes.find(
    p =>
      p.tracking_casilla?.toLowerCase() === tracking.toLowerCase() ||
      p.tracking_origen?.toLowerCase() === tracking.toLowerCase()
  )

  return NextResponse.json({ paquete: exacto ?? paquetes[0] })
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
    // Modo B: sin asignar
    sin_asignar?: boolean
    descripcion?: string
    tienda?: string
    tracking_origen?: string
    categoria?: string
    bodega_destino?: string
    // Ambos modos
    foto_url?: string
    foto2_url?: string
  }

  const admin = getSupabaseAdmin()

  // ── MODO B: Crear paquete sin cliente (con detección de duplicados) ─────
  if (body.sin_asignar) {
    const { descripcion, tienda, tracking_origen, categoria, bodega_destino, notas_internas, foto_url } = body
    const peso_libras = body.peso_libras
    const trackingOrigenLimpio = tracking_origen?.trim() || null

    if (!descripcion || !peso_libras || peso_libras <= 0 || !categoria) {
      return NextResponse.json({ error: 'descripcion, peso y categoria son requeridos' }, { status: 400 })
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

        // Si tenía cliente, notificar (Meta directo con fotos)
        if (existente.cliente_id) {
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

    // ─ No hay duplicado: crear paquete nuevo sin asignar ─
    const { data: nuevo, error: insertErr } = await admin
      .from('paquetes')
      .insert({
        cliente_id: null,
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
      descripcion: notas_internas
        ? `Recibido sin asignar. ${notas_internas}`
        : 'Recibido en bodega USA — sin cliente asignado',
      ubicacion: 'Miami, USA',
    })

    return NextResponse.json({ ok: true, tracking_casilla: nuevo.tracking_casilla, fusionado: false })
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

  // Notificar WhatsApp al cliente (con fotos si las hay)
  try {
    await notificarCambioEstado(paquete_id, 'recibido_usa')
  } catch (err) {
    console.error('[recibir modo A] notificación:', err)
  }

  return NextResponse.json({ ok: true, tracking: paquete.tracking_casilla })
}
