// src/lib/bot/engine.ts
// Motor del bot — NO necesitas editar este archivo
// Flujo: clasificar intención → obtener datos DB si aplica → Claude genera respuesta natural

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { BOT_CONFIG, ESTADO_TEXTO } from './config'

// ── Tipos ─────────────────────────────────────────────────────

export interface KommoMessage {
  lead_id: number
  contact_id: number
  talk_id?: string
  chat_id?: string
  text: string
  author_type: string
  author_id: number
}

interface Clasificacion {
  intencion: 'tracking' | 'ver_paquetes' | 'casilla' | 'escalar' | 'confirmacion' | 'saludo' | 'cotizar' | 'otro'
  tracking: string | null
  tienda: string | null
  descripcion: string | null
  confirmacion_positiva: boolean | null
}

interface ClienteInfo {
  id: string
  nombre_completo: string
  numero_casilla: string
  email: string
  whatsapp: string | null
}

interface PaqueteInfo {
  tracking_casilla: string
  tracking_usa: string | null
  descripcion: string
  tienda: string
  estado: string
  costo_servicio: number
  factura_pagada: boolean
  updated_at: string
}

// ── Estado en memoria — tracking pendiente de confirmación ────
const pendienteConfirmacion = new Map<number, {
  tracking: string
  tienda: string
  descripcion: string
  timestamp: number
}>()

// ── Clientes ──────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

// ── Utilidades ────────────────────────────────────────────────

function contieneKeyword(texto: string, keywords: string[]): boolean {
  const t = texto.toLowerCase()
  return keywords.some(k => t.includes(k.toLowerCase()))
}

// ── Buscar cliente en Supabase ────────────────────────────────

async function buscarCliente(kommoContactId: number): Promise<{ cliente: ClienteInfo | null; phone: string | null }> {
  if (!kommoContactId) return { cliente: null, phone: null }
  const supabase = getSupabase()

  const kommoRes = await fetch(
    `https://celadashopper.kommo.com/api/v4/contacts/${kommoContactId}`,
    { headers: { Authorization: `Bearer ${process.env.KOMMO_API_TOKEN}` } }
  )
  if (!kommoRes.ok) return { cliente: null, phone: null }

  const kommoContact = await kommoRes.json() as {
    custom_fields_values?: Array<{ field_code: string; values: Array<{ value: string }> }>
  }

  const campos = kommoContact.custom_fields_values ?? []
  let telefono: string | null = null
  let email: string | null = null

  for (const campo of campos) {
    if (campo.field_code === 'PHONE') telefono = campo.values[0]?.value?.replace(/\D/g, '') ?? null
    if (campo.field_code === 'EMAIL') email = campo.values[0]?.value ?? null
  }

  if (telefono) {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla, email, whatsapp')
      .or(`whatsapp.ilike.%${telefono.slice(-10)}%,telefono.ilike.%${telefono.slice(-10)}%`)
      .eq('activo', true)
      .maybeSingle()
    if (data) return { cliente: data as ClienteInfo, phone: telefono }
  }

  if (email) {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla, email, whatsapp')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle()
    if (data) return { cliente: data as ClienteInfo, phone: telefono }
  }

  return { cliente: null, phone: telefono }
}

// ── Obtener paquetes del cliente ──────────────────────────────

async function getPaquetesCliente(clienteId: string): Promise<PaqueteInfo[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('paquetes')
    .select('tracking_casilla, tracking_usa, descripcion, tienda, estado, costo_servicio, factura_pagada, updated_at')
    .eq('perfil_id', clienteId)
    .not('estado', 'in', '("entregado","devuelto")')
    .order('updated_at', { ascending: false })
  return (data ?? []) as PaqueteInfo[]
}

// ── Crear pre-alerta en Supabase ──────────────────────────────

async function crearPreAlerta(
  clienteId: string, casilla: string,
  tracking: string, tienda: string, descripcion: string
): Promise<boolean> {
  const supabase = getSupabase()
  const trackingCasilla = `${casilla}-${Date.now().toString().slice(-6)}`
  const { error } = await supabase.from('paquetes').insert({
    perfil_id: clienteId,
    tracking_casilla: trackingCasilla,
    tracking_usa: tracking,
    tienda: tienda || 'No especificada',
    descripcion: descripcion || 'Sin descripción',
    estado: 'esperando_en_usa',
    peso_facturable: 0,
    costo_servicio: 0,
    factura_pagada: false,
  })
  return !error
}

// ── Paso 1: Clasificar intención rápido ───────────────────────

async function clasificarMensaje(texto: string): Promise<Clasificacion> {
  const anthropic = getAnthropic()
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: BOT_CONFIG.promptClasificacion,
      messages: [{ role: 'user', content: texto }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    return JSON.parse(jsonMatch[0]) as Clasificacion
  } catch {
    return { intencion: 'otro', tracking: null, tienda: null, descripcion: null, confirmacion_positiva: null }
  }
}

// ── Paso 2: Claude genera la respuesta como agente ────────────
// contextoExtra = datos de DB (paquetes, casilla) ya formateados para Claude

async function generarRespuesta(
  mensajeCliente: string,
  nombreCliente: string | null,
  contextoExtra: string
): Promise<string> {
  const anthropic = getAnthropic()

  const systemCompleto = BOT_CONFIG.promptAgente +
    (nombreCliente ? `\n\nNOMBRE DEL CLIENTE: ${nombreCliente}` : '') +
    (contextoExtra ? `\n\n${contextoExtra}` : '')

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemCompleto,
      messages: [{ role: 'user', content: mensajeCliente }],
    })
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : fallbackNoEntendi()
  } catch (e) {
    console.error('[bot] Error generando respuesta con Claude:', e)
    return fallbackNoEntendi()
  }
}

function fallbackNoEntendi(): string {
  return 'Para darte información precisa voy a validarlo con un asesor 🙌'
}

// ── Enviar via Meta WhatsApp Cloud API ────────────────────────

async function enviarPorMeta(phone: string, texto: string): Promise<boolean> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    console.warn('[bot] META_WA_PHONE_ID o META_WA_TOKEN no configurados')
    return false
  }
  const cleanPhone = phone.replace(/\D/g, '')
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: texto },
      }),
    })
    const body = await res.text()
    if (res.ok) { console.log(`[bot] ✅ WhatsApp enviado → ${cleanPhone}`); return true }
    console.warn(`[bot] ⚠️ Meta API falló (${res.status}): ${body.slice(0, 300)}`)
    return false
  } catch (e) {
    console.error('[bot] ❌ Meta API error:', e)
    return false
  }
}

// ── Fallback: nota CRM si Meta falla ─────────────────────────

async function enviarNotaKommo(leadId: number, texto: string): Promise<void> {
  const token = process.env.KOMMO_API_TOKEN
  const res = await fetch(`https://celadashopper.kommo.com/api/v4/leads/${leadId}/notes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ note_type: 'common', params: { text: `🤖 BOT: ${texto}` } }]),
  })
  if (res.ok) console.warn(`[bot] ⚠️ Solo nota CRM lead=${leadId}`)
  else console.error(`[bot] ❌ Nota CRM falló lead=${leadId}:`, await res.text())
}

// ── Escalar lead en Kommo ─────────────────────────────────────

async function escalarEnKommo(leadId: number): Promise<void> {
  const token = process.env.KOMMO_API_TOKEN
  const { kommoStatusEscalacion, kommoAsesorId } = BOT_CONFIG.config
  const res = await fetch('https://celadashopper.kommo.com/api/v4/leads', {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ id: leadId, status_id: kommoStatusEscalacion, responsible_user_id: kommoAsesorId }]),
  })
  if (res.ok) console.log(`[bot] ✅ Lead ${leadId} escalado → asesor ${kommoAsesorId}`)
  else console.warn(`[bot] ⚠️ No se pudo escalar lead ${leadId} (${res.status})`)
}

// ── Motor principal ───────────────────────────────────────────

export async function procesarMensaje(msg: KommoMessage): Promise<void> {
  const { lead_id, contact_id, talk_id, chat_id, text, author_type, author_id } = msg

  // Kill switch
  if (process.env.BOT_DISABLED === 'true') return

  // Ignorar mensajes propios del bot/agentes
  if (author_type === 'user') return
  if (author_id === BOT_CONFIG.config.kommoUserId) return

  const texto = text?.trim()
  if (!texto || texto.length < 2) return

  console.log(`[bot] Mensaje lead ${lead_id}: "${texto.slice(0, 80)}"`)

  // Buscar cliente (teléfono para Meta API + datos de cuenta)
  const { cliente, phone: waPhone } = await buscarCliente(contact_id)
  const nombreCliente = cliente?.nombre_completo?.split(' ')[0] ?? null

  // Helper para enviar
  const enviar = async (respuesta: string) => {
    if (waPhone) {
      const ok = await enviarPorMeta(waPhone, respuesta)
      if (ok) return
    }
    await enviarNotaKommo(lead_id, respuesta)
  }

  // ── 1. Escalación por keywords (rápido, sin Claude) ────────
  if (contieneKeyword(texto, BOT_CONFIG.escalarSiDice)) {
    const respuesta = await generarRespuesta(texto, nombreCliente,
      'ACCIÓN REQUERIDA: El cliente pide hablar con un asesor o tiene un problema. Responde el mensaje de transferencia a asesor, breve y amable.')
    await enviar(respuesta)
    await escalarEnKommo(lead_id)
    return
  }

  // ── 2. Ver paquetes por keywords (rápido) ──────────────────
  if (contieneKeyword(texto, BOT_CONFIG.verPaquetesSiDice)) {
    if (!cliente) {
      const respuesta = await generarRespuesta(texto, null,
        'El cliente pregunta por sus paquetes pero no está registrado en el sistema. Pídele amablemente su correo o teléfono para buscarlo.')
      await enviar(respuesta)
      return
    }
    const paquetes = await getPaquetesCliente(cliente.id)
    if (paquetes.length === 0) {
      const respuesta = await generarRespuesta(texto, nombreCliente,
        'DATOS: El cliente no tiene paquetes activos. Invítalo a registrar un tracking si ya hizo una compra.')
      await enviar(respuesta)
      return
    }
    const listaPaquetes = paquetes.map(p =>
      `• ${p.tracking_casilla} — ${p.tienda} | ${ESTADO_TEXTO[p.estado] ?? p.estado} | ${p.factura_pagada ? 'Pagado ✅' : `$${p.costo_servicio} USD pendiente`} | Actualizado: ${new Date(p.updated_at).toLocaleDateString('es-CO')}`
    ).join('\n')
    const respuesta = await generarRespuesta(texto, nombreCliente,
      `DATOS DE PAQUETES DEL CLIENTE (muéstralos claramente):\n${listaPaquetes}`)
    await enviar(respuesta)
    return
  }

  // ── 3. Casilla por keywords (rápido) ───────────────────────
  if (contieneKeyword(texto, BOT_CONFIG.casillaSiDice)) {
    if (!cliente) {
      const respuesta = await generarRespuesta(texto, null,
        'El cliente pide su casilla pero no está registrado. Pídele su correo o teléfono para buscarlo.')
      await enviar(respuesta)
      return
    }
    const respuesta = await generarRespuesta(texto, nombreCliente,
      `DATOS CASILLA: Número de casilla del cliente: ${cliente.numero_casilla}. Dirección completa: 8164 NW 108TH PL, Doral, FL 33178, Suite ${cliente.numero_casilla}. Explícale cómo usarla.`)
    await enviar(respuesta)
    return
  }

  // ── 4. Verificar confirmación pendiente de tracking ────────
  const pendiente = pendienteConfirmacion.get(lead_id)
  const hace5min = Date.now() - 5 * 60 * 1000

  if (pendiente && pendiente.timestamp > hace5min) {
    const clas = await clasificarMensaje(texto)

    if (clas.intencion === 'confirmacion' && clas.confirmacion_positiva === true) {
      if (cliente) {
        const ok = await crearPreAlerta(cliente.id, cliente.numero_casilla, pendiente.tracking, pendiente.tienda, pendiente.descripcion)
        pendienteConfirmacion.delete(lead_id)
        if (ok) {
          const respuesta = await generarRespuesta(texto, nombreCliente,
            `ACCIÓN COMPLETADA: El tracking ${pendiente.tracking} de ${pendiente.tienda} fue registrado exitosamente como pre-alerta. Confirma al cliente con entusiasmo.`)
          await enviar(respuesta)
        }
      } else {
        const respuesta = await generarRespuesta(texto, null,
          'El cliente confirmó el tracking pero no está registrado. Pídele su correo para crear la pre-alerta en su cuenta.')
        await enviar(respuesta)
      }
      return
    }

    if (clas.intencion === 'confirmacion' && clas.confirmacion_positiva === false) {
      pendienteConfirmacion.delete(lead_id)
      const respuesta = await generarRespuesta(texto, nombreCliente,
        'El cliente canceló el registro del tracking. Confirma brevemente y ofrécele ayuda.')
      await enviar(respuesta)
      return
    }
  }

  // ── 5. Clasificación Claude para otros mensajes ────────────
  const clas = await clasificarMensaje(texto)
  console.log(`[bot] Intención: ${clas.intencion}`, clas.tracking ? `| tracking: ${clas.tracking}` : '')

  // Tracking detectado
  if (clas.intencion === 'tracking' && clas.tracking) {
    const tracking = clas.tracking
    const tienda = clas.tienda ?? 'No especificada'
    const descripcion = clas.descripcion ?? 'Sin descripción'

    pendienteConfirmacion.set(lead_id, { tracking, tienda, descripcion, timestamp: Date.now() })

    const contexto = clas.tienda || clas.descripcion
      ? `El cliente envió un tracking. Pídele confirmación de estos datos:\n- Tracking: ${tracking}\n- Tienda: ${tienda}\n- Producto: ${descripcion}\nPregunta si los datos son correctos para registrar la pre-alerta.`
      : `El cliente envió el tracking ${tracking} pero sin info de tienda ni producto. Pídele que te diga de qué tienda es y qué compró para poder registrarlo.`

    const respuesta = await generarRespuesta(texto, nombreCliente, contexto)
    await enviar(respuesta)
    return
  }

  // Escalar detectado por Claude
  if (clas.intencion === 'escalar') {
    const respuesta = await generarRespuesta(texto, nombreCliente,
      'ACCIÓN: El cliente tiene un problema o pide asesor. Responde que lo vas a transferir con un asesor especializado.')
    await enviar(respuesta)
    await escalarEnKommo(lead_id)
    return
  }

  // ── 6. Todos los demás casos → Claude responde libremente ──
  // Saludo, cotizar, FAQ, preguntas generales, etc.
  const respuesta = await generarRespuesta(texto, nombreCliente,
    cliente
      ? `El cliente está registrado en el sistema. Su casilla es ${cliente.numero_casilla}.`
      : 'El cliente NO está registrado aún en el sistema.')

  await enviar(respuesta)
}
