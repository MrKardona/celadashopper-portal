// src/lib/notificaciones/por-estado.ts
// Envía WhatsApp automático al cliente ante cambios relevantes del paquete.
// Estrategia: Meta directo primero (más confiable). Fallback a Kommo si falla.

import { createClient } from '@supabase/supabase-js'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ESTADO_A_EVENTO: Record<string, string> = {
  recibido_usa: 'paquete_recibido_usa',
  en_consolidacion: 'paquete_en_consolidacion',
  listo_envio: 'paquete_listo_envio',
  en_transito: 'paquete_en_transito',
  en_colombia: 'paquete_en_colombia',
  en_bodega_local: 'paquete_listo_recoger',
  en_camino_cliente: 'paquete_en_camino_cliente',
  entregado: 'paquete_entregado',
  retenido: 'paquete_retenido',
  devuelto: 'paquete_devuelto',
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

function rellenarPlantilla(plantilla: string, vars: Record<string, string>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ─── Envío vía Meta directo (preferido) ──────────────────────────────────────
async function enviarMetaDirecto(phone: string, mensaje: string): Promise<boolean> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) return false

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: dest,
        type: 'text',
        text: { body: mensaje },
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[Meta directo] Error:', err)
    return false
  }
}

// ─── Envío con fallback Meta → Kommo ────────────────────────────────────────
async function enviarConFallback(phone: string, mensaje: string): Promise<{ enviado: boolean; via: string }> {
  // Intentar Meta primero
  const metaOk = await enviarMetaDirecto(phone, mensaje)
  if (metaOk) return { enviado: true, via: 'meta' }

  // Fallback: Kommo
  try {
    const r = await sendProactiveWhatsApp(phone, mensaje)
    return { enviado: r.enviado, via: `kommo_${r.metodo}` }
  } catch (err) {
    console.error('[Kommo fallback] Error:', err)
    return { enviado: false, via: 'fallido' }
  }
}

// ─── Cargar paquete + plantilla en una función reutilizable ─────────────────
async function cargarContexto(paqueteId: string, evento: string) {
  const supabase = getSupabase()
  const [paqueteRes, plantillaRes] = await Promise.all([
    supabase
      .from('paquetes')
      .select('*, perfiles(nombre_completo, whatsapp, telefono, email)')
      .eq('id', paqueteId)
      .single(),
    supabase
      .from('plantillas_notificacion')
      .select('texto_plantilla')
      .eq('evento', evento)
      .eq('activa', true)
      .maybeSingle(),
  ])

  if (paqueteRes.error || !paqueteRes.data) return null
  if (!plantillaRes.data) return null

  const paquete = paqueteRes.data
  const perfil = paquete.perfiles as {
    nombre_completo: string
    whatsapp: string | null
    telefono: string | null
    email: string | null
  } | null

  if (!perfil) return null
  const phone = perfil.whatsapp ?? perfil.telefono ?? ''
  if (!phone) return null

  const nombre = perfil.nombre_completo?.split(' ')[0] ?? 'Cliente'
  const peso = paquete.peso_facturable
    ? `${paquete.peso_facturable} lbs`
    : paquete.peso_libras
      ? `${paquete.peso_libras} lbs`
      : 'Por determinar'
  const costo = paquete.costo_servicio
    ? `$${paquete.costo_servicio} USD`
    : 'Por determinar'
  const bodega = BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino

  return {
    supabase,
    paquete,
    perfil,
    phone,
    plantilla: plantillaRes.data.texto_plantilla,
    vars: {
      nombre,
      descripcion: paquete.descripcion ?? '',
      peso,
      costo,
      bodega,
      tracking: paquete.tracking_casilla ?? '',
      tracking_usaco: paquete.tracking_usaco ?? '',
    },
  }
}

// ─── Notificar cambio de estado ──────────────────────────────────────────────
export async function notificarCambioEstado(paqueteId: string, estadoNuevo: string): Promise<void> {
  const evento = ESTADO_A_EVENTO[estadoNuevo]
  const supabase = getSupabase()

  // Si no hay evento mapeado, registrar y salir
  if (!evento) {
    console.warn(`[notificarCambioEstado] Estado "${estadoNuevo}" no tiene evento mapeado`)
    await supabase.from('notificaciones').insert({
      paquete_id: paqueteId,
      tipo: 'estado_sin_plantilla',
      titulo: `Estado cambió a ${estadoNuevo} (sin notificación configurada)`,
      mensaje: `No hay plantilla configurada para el estado "${estadoNuevo}". El cambio se registró pero no se envió WhatsApp.`,
      enviada_whatsapp: false,
    }).then(() => {/* ok */}, (e) => console.error('[notif estado_sin_plantilla]', e))
    return
  }

  try {
    const ctx = await cargarContexto(paqueteId, evento)
    if (!ctx) {
      console.warn(`[notificarCambioEstado] Contexto faltante para paquete ${paqueteId} evento ${evento}`)
      await supabase.from('notificaciones').insert({
        paquete_id: paqueteId,
        tipo: evento,
        titulo: `Notificación no enviada: ${estadoNuevo}`,
        mensaje: 'No se encontró perfil del cliente, plantilla activa o teléfono. Revisa configuración.',
        enviada_whatsapp: false,
      }).then(() => {/* ok */}, (e) => console.error('[notif sin_contexto]', e))
      return
    }

    const mensaje = rellenarPlantilla(ctx.plantilla, ctx.vars)
    const r = await enviarConFallback(ctx.phone, mensaje)

    console.log(`[notificarCambioEstado] paquete=${paqueteId} estado=${estadoNuevo} via=${r.via} enviado=${r.enviado}`)

    await supabase.from('notificaciones').insert({
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: evento,
      titulo: `Estado: ${estadoNuevo} (via ${r.via})`,
      mensaje,
      enviada_whatsapp: r.enviado,
    })
  } catch (err) {
    console.error('[notificarCambioEstado] Error:', err)
    await supabase.from('notificaciones').insert({
      paquete_id: paqueteId,
      tipo: evento,
      titulo: `Error notificando ${estadoNuevo}`,
      mensaje: err instanceof Error ? err.message : String(err),
      enviada_whatsapp: false,
    }).then(() => {/* ok */}, () => {/* swallow */})
  }
}

// ─── Notificar tracking USACO actualizado ────────────────────────────────────
export async function notificarTrackingActualizado(paqueteId: string): Promise<void> {
  try {
    const ctx = await cargarContexto(paqueteId, 'tracking_actualizado')
    if (!ctx) return
    if (!ctx.vars.tracking_usaco) return // sin valor no notificamos

    const mensaje = rellenarPlantilla(ctx.plantilla, ctx.vars)
    const r = await enviarConFallback(ctx.phone, mensaje)

    await ctx.supabase.from('notificaciones').insert({
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: 'tracking_actualizado',
      titulo: 'Tracking interno asignado',
      mensaje,
      enviada_whatsapp: r.enviado,
    })
  } catch (err) {
    console.error('[notificarTrackingActualizado] Error:', err)
  }
}

// ─── Notificar costo calculado ───────────────────────────────────────────────
export async function notificarCostoCalculado(paqueteId: string): Promise<void> {
  try {
    const ctx = await cargarContexto(paqueteId, 'costo_calculado')
    if (!ctx) return
    if (!ctx.paquete.costo_servicio) return // sin costo no notificamos

    const mensaje = rellenarPlantilla(ctx.plantilla, ctx.vars)
    const r = await enviarConFallback(ctx.phone, mensaje)

    await ctx.supabase.from('notificaciones').insert({
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: 'costo_calculado',
      titulo: 'Costo del servicio calculado',
      mensaje,
      enviada_whatsapp: r.enviado,
    })
  } catch (err) {
    console.error('[notificarCostoCalculado] Error:', err)
  }
}
