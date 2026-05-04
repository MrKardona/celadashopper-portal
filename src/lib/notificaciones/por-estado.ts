// src/lib/notificaciones/por-estado.ts
// Envía WhatsApp automático al cliente ante cambios relevantes del paquete.
// Estrategia: Meta directo primero (más confiable). Fallback a Kommo si falla.

import { createClient } from '@supabase/supabase-js'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'
import sharp from 'sharp'

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

// Tracker de último resultado de Meta (para trazabilidad en notificaciones)
let __ultimoMetaInfo: { messageId?: string; destino?: string; statusFinal?: string; rawError?: string } = {}
export function getUltimoMetaInfo() { return { ...__ultimoMetaInfo } }

// ─── Envío vía Meta directo (preferido) ──────────────────────────────────────
async function enviarMetaDirecto(phone: string, mensaje: string): Promise<boolean> {
  __ultimoMetaInfo = {}
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    __ultimoMetaInfo = { rawError: 'META_WA_PHONE_ID/TOKEN no configurados' }
    return false
  }

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`
  __ultimoMetaInfo.destino = dest

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

    const raw = await res.text()
    if (!res.ok) {
      __ultimoMetaInfo.rawError = `Meta ${res.status}: ${raw.slice(0, 400)}`
      console.error('[Meta directo]', __ultimoMetaInfo.rawError)
      return false
    }
    try {
      const data = JSON.parse(raw) as {
        messages?: { id?: string; message_status?: string }[]
        contacts?: { wa_id?: string; input?: string }[]
      }
      __ultimoMetaInfo.messageId = data.messages?.[0]?.id
      __ultimoMetaInfo.statusFinal = data.messages?.[0]?.message_status ?? 'accepted'
      // Si Meta no incluyó el destino en contacts, podría ser señal de número no-WhatsApp
      if (data.contacts && data.contacts.length === 0) {
        __ultimoMetaInfo.rawError = 'Meta no resolvió contactos (número podría no tener WhatsApp activo)'
      }
    } catch { /* ignorar parse error */ }
    return true
  } catch (err) {
    __ultimoMetaInfo.rawError = err instanceof Error ? err.message : String(err)
    console.error('[Meta directo] Error:', err)
    return false
  }
}

// ─── Subir imagen a Meta y obtener media_id (más confiable que link público) ─
async function subirMedia(imageUrl: string): Promise<string | null> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) return null

  try {
    // 1. Descargar la imagen a un Buffer
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      console.error('[subirMedia] No se pudo descargar imagen:', imgRes.status, imageUrl)
      return null
    }
    const contentTypeOrig = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const arrayBuf = await imgRes.arrayBuffer()

    // 2. Convertir SIEMPRE a JPEG con Sharp (WhatsApp tiene problemas con WebP)
    let jpegBuffer: Buffer
    try {
      jpegBuffer = await sharp(Buffer.from(arrayBuf))
        .rotate() // respetar orientación EXIF
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
      console.log(`[subirMedia] Convertido ${contentTypeOrig} → image/jpeg`)
    } catch (convErr) {
      console.error('[subirMedia] Sharp falló, usando original:', convErr)
      jpegBuffer = Buffer.from(arrayBuf)
    }

    // 3. Subir a Meta como multipart/form-data (siempre como JPEG)
    const form = new FormData()
    form.append('messaging_product', 'whatsapp')
    form.append('type', 'image/jpeg')
    // Pasar como Uint8Array para evitar issue de typing con Buffer
    form.append('file', new Blob([new Uint8Array(jpegBuffer)], { type: 'image/jpeg' }), 'image.jpg')

    const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text()
      console.error('[subirMedia] Meta upload falló:', uploadRes.status, errBody.slice(0, 300))
      return null
    }

    const data = await uploadRes.json() as { id?: string }
    return data.id ?? null
  } catch (err) {
    console.error('[subirMedia] Error:', err)
    return null
  }
}

// ─── Envío de imagen vía Meta directo (con upload media) ─────────────────────
async function enviarImagenMeta(phone: string, imageUrl: string, caption?: string): Promise<boolean> {
  __ultimoMetaInfo = {}
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    __ultimoMetaInfo = { rawError: 'META_WA_PHONE_ID/TOKEN no configurados' }
    return false
  }

  const numero = phone.replace(/\D/g, '')
  const dest = numero.startsWith('57') ? numero : `57${numero}`
  __ultimoMetaInfo.destino = dest

  // Estrategia 1: subir media a Meta (más confiable)
  const mediaId = await subirMedia(imageUrl)

  try {
    const imagePayload = mediaId
      ? (caption ? { id: mediaId, caption } : { id: mediaId })
      : (caption ? { link: imageUrl, caption } : { link: imageUrl }) // fallback link

    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: dest,
        type: 'image',
        image: imagePayload,
      }),
    })
    const raw = await res.text()
    if (!res.ok) {
      __ultimoMetaInfo.rawError = `Meta imagen ${res.status}: ${raw.slice(0, 400)}`
      console.error('[Meta imagen]', __ultimoMetaInfo.rawError)
      return false
    }
    try {
      const data = JSON.parse(raw) as {
        messages?: { id?: string }[]
        contacts?: { wa_id?: string; input?: string }[]
      }
      __ultimoMetaInfo.messageId = data.messages?.[0]?.id
      if (data.contacts && data.contacts.length === 0) {
        __ultimoMetaInfo.rawError = 'Meta no resolvió contactos (número podría no tener WhatsApp activo)'
      }
    } catch { /* ignorar */ }
    console.log('[Meta imagen send] OK', mediaId ? `via media_id=${mediaId}` : 'via link', 'msg_id=', __ultimoMetaInfo.messageId)
    return true
  } catch (err) {
    __ultimoMetaInfo.rawError = err instanceof Error ? err.message : String(err)
    console.error('[Meta imagen] Error:', err)
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
// Hacemos 3 queries separadas (paquete, perfil, plantilla) en paralelo en
// lugar de embeds — los embeds de PostgREST a veces fallan silenciosamente.
async function cargarContexto(paqueteId: string, evento: string) {
  const supabase = getSupabase()

  // 1. Cargar el paquete (sin embed)
  const { data: paquete, error: errPaquete } = await supabase
    .from('paquetes')
    .select('*')
    .eq('id', paqueteId)
    .maybeSingle()

  if (errPaquete) {
    console.error('[cargarContexto] error paquete:', errPaquete.message)
    return null
  }
  if (!paquete) {
    console.warn(`[cargarContexto] paquete ${paqueteId} no encontrado`)
    return null
  }
  if (!paquete.cliente_id) {
    console.warn(`[cargarContexto] paquete ${paqueteId} sin cliente_id`)
    return null
  }

  // 2. Cargar perfil del cliente y plantilla en paralelo
  const [perfilRes, plantillaRes] = await Promise.all([
    supabase
      .from('perfiles')
      .select('nombre_completo, whatsapp, telefono, email')
      .eq('id', paquete.cliente_id)
      .maybeSingle(),
    supabase
      .from('plantillas_notificacion')
      .select('texto_plantilla')
      .eq('evento', evento)
      .eq('activa', true)
      .maybeSingle(),
  ])

  if (!plantillaRes.data) {
    console.warn(`[cargarContexto] plantilla "${evento}" no activa o no existe`)
    return null
  }

  const perfil = perfilRes.data
  if (!perfil) {
    console.warn(`[cargarContexto] perfil del cliente ${paquete.cliente_id} no encontrado`)
    return null
  }

  const phone = perfil.whatsapp ?? perfil.telefono ?? ''
  if (!phone) {
    console.warn(`[cargarContexto] cliente ${paquete.cliente_id} sin teléfono ni whatsapp`)
    return null
  }

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
      link: `https://portal.celadashopper.com/paquetes/${paqueteId}`,
    },
  }
}

// ─── Helper: insert seguro en notificaciones (loguea error real) ────────────
async function logNotificacion(
  supabase: ReturnType<typeof getSupabase>,
  data: {
    cliente_id?: string | null
    paquete_id?: string | null
    tipo: string
    titulo: string
    mensaje: string
    enviada_whatsapp?: boolean
  },
) {
  const { error } = await supabase.from('notificaciones').insert({
    cliente_id: data.cliente_id ?? null,
    paquete_id: data.paquete_id ?? null,
    tipo: data.tipo,
    titulo: data.titulo,
    mensaje: data.mensaje,
    enviada_whatsapp: data.enviada_whatsapp ?? false,
  })
  if (error) {
    console.error('[logNotificacion] INSERT falló:', error.message, error.code, error.details)
  }
}

// ─── Notificar cambio de estado ──────────────────────────────────────────────
export async function notificarCambioEstado(paqueteId: string, estadoNuevo: string): Promise<void> {
  const evento = ESTADO_A_EVENTO[estadoNuevo]
  const supabase = getSupabase()

  // Cargar cliente_id al inicio para usarlo en cualquier rama (audit trail)
  const { data: paqueteBasico } = await supabase
    .from('paquetes')
    .select('cliente_id')
    .eq('id', paqueteId)
    .maybeSingle()
  const clienteIdAuditoria = paqueteBasico?.cliente_id ?? null

  // Si no hay evento mapeado, registrar y salir
  if (!evento) {
    console.warn(`[notificarCambioEstado] Estado "${estadoNuevo}" no tiene evento mapeado`)
    await logNotificacion(supabase, {
      cliente_id: clienteIdAuditoria,
      paquete_id: paqueteId,
      tipo: 'estado_sin_plantilla',
      titulo: `Estado cambió a ${estadoNuevo} (sin notificación configurada)`,
      mensaje: `No hay plantilla configurada para el estado "${estadoNuevo}".`,
    })
    return
  }

  try {
    const ctx = await cargarContexto(paqueteId, evento)
    if (!ctx) {
      console.warn(`[notificarCambioEstado] Contexto faltante paquete=${paqueteId} evento=${evento}`)
      await logNotificacion(supabase, {
        cliente_id: clienteIdAuditoria,
        paquete_id: paqueteId,
        tipo: evento,
        titulo: `Notificación no enviada: ${estadoNuevo}`,
        mensaje: 'No se encontró perfil del cliente, plantilla activa o teléfono. Revisa configuración.',
      })
      return
    }

    const mensaje = rellenarPlantilla(ctx.plantilla, ctx.vars)

    // ── Solo 'recibido_usa' envía foto del paquete ──────────────────────────
    // Los demás estados (en_consolidacion, en_transito, etc.) van solo texto
    const enviaFotos = estadoNuevo === 'recibido_usa'
    let fotosEnviadas = 0
    let envioOk = false
    let viaUsada = 'meta'

    if (enviaFotos) {
      // Buscar fotos asociadas al paquete
      const { data: fotos } = await supabase
        .from('fotos_paquetes')
        .select('url, descripcion')
        .eq('paquete_id', paqueteId)
        .order('created_at', { ascending: true })
        .limit(5)

      // Estrategia: UN SOLO MENSAJE con la foto del CONTENIDO + texto como caption.
      // Identificamos la foto del contenido por su descripción.
      // Fallback: si no hay foto con "contenido" en descripción, usamos la última
      // foto subida (que típicamente es la del contenido).
      const fotoContenido = fotos?.find(f =>
        (f.descripcion ?? '').toLowerCase().includes('contenido')
      ) ?? (fotos && fotos.length > 0 ? fotos[fotos.length - 1] : null)

      if (fotoContenido) {
        const ok = await enviarImagenMeta(ctx.phone, fotoContenido.url, mensaje)
        envioOk = ok
        viaUsada = ok ? 'meta_imagen+caption' : 'meta_imagen_falló'
        if (ok) {
          fotosEnviadas = 1
          console.log('[notif] Imagen contenido + caption enviada OK:', fotoContenido.url)
        } else {
          // Si la imagen falla, mandamos al menos el texto
          console.warn('[notif] Imagen contenido falló, fallback a solo texto')
          const r = await enviarConFallback(ctx.phone, mensaje)
          envioOk = r.enviado
          viaUsada = `${r.via}_fallback_texto`
        }
      } else {
        // No hay fotos: solo texto
        const r = await enviarConFallback(ctx.phone, mensaje)
        envioOk = r.enviado
        viaUsada = r.via
      }
    } else {
      // Otros estados: solo texto
      const r = await enviarConFallback(ctx.phone, mensaje)
      envioOk = r.enviado
      viaUsada = r.via
    }

    console.log(`[notificarCambioEstado] paquete=${paqueteId} estado=${estadoNuevo} via=${viaUsada} enviado=${envioOk} fotos=${fotosEnviadas}`)

    // Capturar info de Meta para trazabilidad
    const metaInfo = getUltimoMetaInfo()
    const tituloEnriquecido = `Estado: ${estadoNuevo} (${viaUsada}${fotosEnviadas > 0 ? `, ${fotosEnviadas} foto${fotosEnviadas > 1 ? 's' : ''}` : ''})${metaInfo.messageId ? ` [msg_id=${metaInfo.messageId.slice(-12)}]` : ''}${metaInfo.rawError ? ' [ALERTA]' : ''}`
    const mensajeEnriquecido = metaInfo.rawError
      ? `${mensaje}\n\n[META INFO]\nDestino: ${metaInfo.destino ?? '?'}\nError: ${metaInfo.rawError}`
      : metaInfo.messageId
        ? `${mensaje}\n\n[META OK] msg_id=${metaInfo.messageId} destino=${metaInfo.destino ?? '?'}`
        : mensaje

    await logNotificacion(supabase, {
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: evento,
      titulo: tituloEnriquecido,
      mensaje: mensajeEnriquecido,
      enviada_whatsapp: envioOk,
    })
  } catch (err) {
    console.error('[notificarCambioEstado] Error:', err)
    await logNotificacion(supabase, {
      cliente_id: clienteIdAuditoria,
      paquete_id: paqueteId,
      tipo: evento,
      titulo: `Error notificando ${estadoNuevo}`,
      mensaje: err instanceof Error ? err.message : String(err),
    })
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
