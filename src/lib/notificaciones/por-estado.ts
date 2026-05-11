// src/lib/notificaciones/por-estado.ts
// Envía WhatsApp automático al cliente ante cambios relevantes del paquete.
// Estrategia: Meta directo primero (más confiable). Fallback a Kommo si falla.

import { createClient } from '@supabase/supabase-js'
import {
  enviarEmailPorEstado,
  enviarEmailCostoCalculado,
  enviarEmailTrackingActualizado,
} from '@/lib/email/notificaciones'
import { calcularTarifa } from '@/lib/tarifas/calcular'
import type { ResultadoEmail } from '@/lib/email/transporter'
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

// ─── Meta-approved Utility templates (category=Utility, language=es) ─────────
// Creadas en Kommo → se sincronizan con Meta Business Manager.
// Solo eventos listados aquí usan type:"template". Los demás siguen en texto libre
// (válido únicamente dentro de la ventana de 24h de respuesta del cliente).
type PaqRaw = Record<string, unknown>
const EVENTO_A_TEMPLATE: Record<string, {
  name: string
  params: (vars: Record<string, string>, paq: PaqRaw) => string[]
}> = {
  paquete_recibido_usa: {
    name: 'cs_paquete_recibido_usa_n9bz7s',
    // "📦 ¡Hola {{1}}! Tu paquete llegó a nuestra bodega en Miami, USA\n*{{2}}*\n📌 Tracking: {{3}}\n⚖️ Peso: {{4}} lb\n💵 Costo de servicio aproximado: ${{5}} USD"
    params: (vars, paq) => [
      vars.nombre,
      vars.descripcion || 'tu paquete',
      vars.tracking_origen || vars.tracking || 'N/D',
      String(paq.peso_facturable ?? paq.peso_libras ?? 'N/A'),
      String(paq.costo_servicio ?? 'N/A'),
    ],
  },
  paquete_en_transito: {
    name: 'cs_en_transito_9b0ji8',
    // "✈️ ¡Hola {{1}}! Tu paquete está en camino a Colombia\n📦 *{{2}}*"
    params: (vars) => [vars.nombre, vars.descripcion || 'tu paquete'],
  },
  paquete_listo_recoger: {
    name: 'cs_listo_recoger_v2_04nkhl', // UTILITY — aprobado
    // "🎉 ¡Hola {{1}}! Tu paquete llegó y está listo\n📦 *{{2}}*\n🛵 Te vamos a programar la entrega..."
    params: (vars) => [vars.nombre, vars.descripcion || 'tu paquete'],
  },
  paquete_entregado: {
    name: 'cs_entregado_jutpck',
    // "✅ ¡Hola {{1}}! Tu paquete fue entregado exitosamente 🎊\n📦 *{{2}}*"
    params: (vars) => [vars.nombre, vars.descripcion || 'tu paquete'],
  },
}

function rellenarPlantilla(plantilla: string, vars: Record<string, string>): string {
  const filled = plantilla.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
  // Remove lines where an optional variable resolved to empty
  // e.g. "🚚 Guía: *  *" or "💵 Valor: " → skip
  return filled
    .split('\n')
    .filter(line => !/^[^:]+:\s*\*?\s*\*?\s*$/.test(line.trim()))
    .join('\n')
}

// Tracker de último resultado de Meta (para trazabilidad en notificaciones)
let __ultimoMetaInfo: { messageId?: string; destino?: string; statusFinal?: string; rawError?: string } = {}
export function getUltimoMetaInfo() { return { ...__ultimoMetaInfo } }

// ─── Envío de template aprobado vía Meta (TOS-compliant para mensajes proactivos) ─
async function enviarMetaTemplate(
  phone: string,
  templateName: string,
  params: string[],
): Promise<boolean> {
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
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: params.map(p => ({ type: 'text', text: p })),
            },
          ],
        },
      }),
    })

    const raw = await res.text()
    if (!res.ok) {
      __ultimoMetaInfo.rawError = `Meta template ${res.status}: ${raw.slice(0, 400)}`
      console.error('[Meta template]', __ultimoMetaInfo.rawError)
      return false
    }
    try {
      const data = JSON.parse(raw) as {
        messages?: { id?: string; message_status?: string }[]
        contacts?: { wa_id?: string }[]
      }
      __ultimoMetaInfo.messageId = data.messages?.[0]?.id
      __ultimoMetaInfo.statusFinal = data.messages?.[0]?.message_status ?? 'accepted'
    } catch { /* ignorar */ }
    console.log('[Meta template] OK', templateName, 'msg_id=', __ultimoMetaInfo.messageId)
    return true
  } catch (err) {
    __ultimoMetaInfo.rawError = err instanceof Error ? err.message : String(err)
    console.error('[Meta template] Error:', err)
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

  const perfil = perfilRes.data
  if (!perfil) {
    console.warn(`[cargarContexto] perfil del cliente ${paquete.cliente_id} no encontrado`)
    return null
  }

  // ⚠️  La plantilla y el teléfono SOLO son requeridos para WhatsApp.
  // El email se envía aunque ambos falten (canal principal independiente).
  const plantilla = plantillaRes.data?.texto_plantilla ?? null
  if (!plantilla) {
    console.warn(`[cargarContexto] plantilla "${evento}" no activa — email seguirá enviándose`)
  }

  const phone = perfil.whatsapp ?? perfil.telefono ?? ''
  if (!phone) {
    console.warn(`[cargarContexto] cliente ${paquete.cliente_id} sin teléfono — email seguirá enviándose`)
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
    plantilla,
    vars: {
      nombre,
      descripcion: paquete.descripcion ?? '',
      peso,
      costo,
      bodega,
      tracking: paquete.tracking_casilla ?? '',
      tracking_usaco: paquete.tracking_usaco ?? '',
      tracking_origen: paquete.tracking_origen ?? '',
      valor_declarado: paquete.valor_declarado
        ? `$${Number(paquete.valor_declarado).toFixed(2)} USD`
        : '',
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
    enviada_email?: boolean
    email_message_id?: string | null
    email_error?: string | null
    email_destino?: string | null
  },
) {
  const { error } = await supabase.from('notificaciones').insert({
    cliente_id: data.cliente_id ?? null,
    paquete_id: data.paquete_id ?? null,
    tipo: data.tipo,
    titulo: data.titulo,
    mensaje: data.mensaje,
    enviada_whatsapp: data.enviada_whatsapp ?? false,
    enviada_email: data.enviada_email ?? false,
    email_message_id: data.email_message_id ?? null,
    email_error: data.email_error ?? null,
    email_destino: data.email_destino ?? null,
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

    // WhatsApp: solo templates aprobados por Meta (TOS-compliant)
    // Eventos sin template en EVENTO_A_TEMPLATE no envían WA — solo email
    const templateDef = EVENTO_A_TEMPLATE[evento]
    const puedeEnviarWa = !!ctx.phone && !!templateDef

    const enviaFotos = estadoNuevo === 'recibido_usa'
    let fotosEnviadas = 0
    let envioOk = false
    let viaUsada = puedeEnviarWa ? 'meta_template' : 'sin_whatsapp'

    if (puedeEnviarWa) {
      const params = templateDef.params(ctx.vars, ctx.paquete as PaqRaw)
      const tmplOk = await enviarMetaTemplate(ctx.phone, templateDef.name, params)
      envioOk = tmplOk
      viaUsada = tmplOk ? 'meta_template' : 'meta_template_falló'

      // recibido_usa: foto del contenido como mensaje separado tras el template
      if (tmplOk && enviaFotos) {
        const { data: fotos } = await supabase
          .from('fotos_paquetes')
          .select('url, descripcion')
          .eq('paquete_id', paqueteId)
          .order('created_at', { ascending: true })
          .limit(5)
        const fotoContenido = fotos?.find(f =>
          (f.descripcion ?? '').toLowerCase().includes('contenido')
        ) ?? (fotos && fotos.length > 0 ? fotos[fotos.length - 1] : null)
        if (fotoContenido) {
          const fotoOk = await enviarImagenMeta(ctx.phone, fotoContenido.url)
          if (fotoOk) {
            fotosEnviadas = 1
            console.log('[notif] Foto contenido enviada tras template OK:', fotoContenido.url)
          }
        }
      }
    }
    // Si !puedeEnviarWa: no hay template aprobado → solo email, sin WA

    console.log(`[notificarCambioEstado] paquete=${paqueteId} estado=${estadoNuevo} via=${viaUsada} enviado=${envioOk} fotos=${fotosEnviadas}`)

    // Capturar info de Meta para trazabilidad
    const metaInfo = getUltimoMetaInfo()
    const tituloEnriquecido = `Estado: ${estadoNuevo} (${viaUsada}${fotosEnviadas > 0 ? `, ${fotosEnviadas} foto${fotosEnviadas > 1 ? 's' : ''}` : ''})${metaInfo.messageId ? ` [msg_id=${metaInfo.messageId.slice(-12)}]` : ''}${metaInfo.rawError ? ' [ALERTA]' : ''}`
    const mensajeEnriquecido = metaInfo.rawError
      ? `[META INFO] Destino: ${metaInfo.destino ?? '?'} Error: ${metaInfo.rawError}`
      : metaInfo.messageId
        ? `[META OK] msg_id=${metaInfo.messageId} destino=${metaInfo.destino ?? '?'}`
        : viaUsada

    // ── Enviar también por EMAIL (canal principal: siempre llega) ──
    let emailRes: ResultadoEmail = { ok: false }
    if (ctx.perfil.email) {
      // Fotos a incluir en el email según el estado:
      // - recibido_usa → foto del empaque (con guía) + foto del contenido
      // - entregado    → foto de la entrega al cliente
      let fotoUrlContenido: string | null = null
      let fotoUrlEmpaque: string | null = null
      if (estadoNuevo === 'recibido_usa' || estadoNuevo === 'entregado') {
        const { data: fotos } = await supabase
          .from('fotos_paquetes')
          .select('url, descripcion, created_at')
          .eq('paquete_id', paqueteId)
          .order('created_at', { ascending: true })
          .limit(10)

        if (estadoNuevo === 'entregado') {
          // Para entregado: priorizar la foto de entrega más reciente
          const fotoEntrega = fotos?.find(f =>
            (f.descripcion ?? '').toLowerCase().includes('entrega')
          )
          fotoUrlContenido = fotoEntrega?.url ?? null
        } else {
          // recibido_usa: 2 fotos — empaque (con guía) y contenido
          const fotoEmpaque = fotos?.find(f =>
            (f.descripcion ?? '').toLowerCase().includes('empaque') ||
            (f.descripcion ?? '').toLowerCase().includes('guía') ||
            (f.descripcion ?? '').toLowerCase().includes('guia')
          )
          const fotoContenido = fotos?.find(f =>
            (f.descripcion ?? '').toLowerCase().includes('contenido')
          )
          fotoUrlEmpaque = fotoEmpaque?.url ?? null
          fotoUrlContenido = fotoContenido?.url ?? null
          // Fallback: si no hay matches por descripción, usar las primeras 2 fotos
          if (!fotoUrlEmpaque && !fotoUrlContenido && fotos && fotos.length > 0) {
            fotoUrlEmpaque = fotos[0].url
            fotoUrlContenido = fotos[1]?.url ?? null
          }
        }
      }

      // Cuando un paquete recién llega a USA, calculamos la tarifa estimada
      // con los datos disponibles (categoría, condición, cantidad, peso, valor)
      // para incluirla en el email del cliente.
      let tarifaCalculada: Awaited<ReturnType<typeof calcularTarifa>> = null
      if (estadoNuevo === 'recibido_usa') {
        try {
          tarifaCalculada = await calcularTarifa({
            categoria: ctx.paquete.categoria,
            condicion: ctx.paquete.condicion ?? null,
            cantidad: ctx.paquete.cantidad ?? 1,
            peso_libras: ctx.paquete.peso_facturable ?? ctx.paquete.peso_libras ?? null,
            valor_declarado: ctx.paquete.valor_declarado ?? null,
          })
        } catch (err) {
          console.error('[notificarCambioEstado] calcularTarifa falló:', err)
        }
      }

      emailRes = await enviarEmailPorEstado(estadoNuevo, {
        emailDestino: ctx.perfil.email,
        nombre: ctx.vars.nombre,
        paqueteId,
        tracking: ctx.vars.tracking,
        descripcion: ctx.vars.descripcion,
        tracking_origen: ctx.paquete.tracking_origen,
        tracking_usaco: ctx.paquete.tracking_usaco,
        peso_libras: ctx.paquete.peso_facturable ?? ctx.paquete.peso_libras,
        costo_servicio: ctx.paquete.costo_servicio,
        bodega_destino: ctx.paquete.bodega_destino,
        tienda: ctx.paquete.tienda,
        fotoUrlContenido,
        fotoUrlEmpaque,
        tarifaCalculada,
      })
      console.log(`[notificarCambioEstado] EMAIL paquete=${paqueteId} estado=${estadoNuevo} ok=${emailRes.ok} msg_id=${emailRes.messageId ?? '?'}`)
    } else {
      emailRes = { ok: false, error: 'Cliente sin email' }
    }

    await logNotificacion(supabase, {
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: evento,
      titulo: tituloEnriquecido,
      mensaje: mensajeEnriquecido,
      enviada_whatsapp: envioOk,
      enviada_email: emailRes.ok,
      email_message_id: emailRes.messageId ?? null,
      email_error: emailRes.error ?? null,
      email_destino: ctx.perfil.email ?? null,
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

    // Email (canal principal, siempre llega)
    let emailRes: ResultadoEmail = { ok: false, error: 'Cliente sin email' }
    if (ctx.perfil.email) {
      emailRes = await enviarEmailTrackingActualizado({
        emailDestino: ctx.perfil.email,
        nombre: ctx.vars.nombre,
        paqueteId,
        tracking: ctx.vars.tracking,
        descripcion: ctx.vars.descripcion,
        tracking_origen: ctx.paquete.tracking_origen,
        tracking_usaco: ctx.paquete.tracking_usaco,
        peso_libras: ctx.paquete.peso_facturable ?? ctx.paquete.peso_libras,
        bodega_destino: ctx.paquete.bodega_destino,
        tienda: ctx.paquete.tienda,
      })
      console.log(`[notificarTrackingActualizado] EMAIL paquete=${paqueteId} ok=${emailRes.ok}`)
    }

    await logNotificacion(ctx.supabase, {
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: 'tracking_actualizado',
      titulo: 'Tracking interno asignado',
      mensaje: `tracking_usaco=${ctx.vars.tracking_usaco}`,
      enviada_whatsapp: false,
      enviada_email: emailRes.ok,
      email_message_id: emailRes.messageId ?? null,
      email_error: emailRes.error ?? null,
      email_destino: ctx.perfil.email ?? null,
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

    // Email (canal principal)
    let emailRes: ResultadoEmail = { ok: false, error: 'Cliente sin email' }
    if (ctx.perfil.email) {
      emailRes = await enviarEmailCostoCalculado({
        emailDestino: ctx.perfil.email,
        nombre: ctx.vars.nombre,
        paqueteId,
        tracking: ctx.vars.tracking,
        descripcion: ctx.vars.descripcion,
        tracking_origen: ctx.paquete.tracking_origen,
        tracking_usaco: ctx.paquete.tracking_usaco,
        peso_libras: ctx.paquete.peso_facturable ?? ctx.paquete.peso_libras,
        costo_servicio: ctx.paquete.costo_servicio,
        bodega_destino: ctx.paquete.bodega_destino,
        tienda: ctx.paquete.tienda,
      })
      console.log(`[notificarCostoCalculado] EMAIL paquete=${paqueteId} ok=${emailRes.ok}`)
    }

    await logNotificacion(ctx.supabase, {
      cliente_id: ctx.paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: 'costo_calculado',
      titulo: 'Costo del servicio calculado',
      mensaje: `costo_servicio=${ctx.paquete.costo_servicio}`,
      enviada_whatsapp: false,
      enviada_email: emailRes.ok,
      email_message_id: emailRes.messageId ?? null,
      email_error: emailRes.error ?? null,
      email_destino: ctx.perfil.email ?? null,
    })
  } catch (err) {
    console.error('[notificarCostoCalculado] Error:', err)
  }
}
