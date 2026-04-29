// src/lib/bot/engine.ts
// Motor del bot — NO necesitas editar este archivo
// Lógica: analizar mensaje → Claude → Supabase → responder por Kommo

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { BOT_CONFIG, ESTADO_TEXTO } from './config'

// ── Tipos ─────────────────────────────────────────────────────

export interface KommoMessage {
  lead_id: number
  contact_id: number
  talk_id?: string   // ID numérico de la conversación activa (e.g. "9146")
  chat_id?: string   // UUID del canal WhatsApp (e.g. "5cf5cddc-...")
  text: string
  author_type: string  // 'contact' = cliente, 'user' = agente/bot
  author_id: number
}

interface ClaudeAnalysis {
  intencion: 'tracking' | 'ver_paquetes' | 'escalar' | 'confirmacion' | 'casilla' | 'otro'
  tracking: string | null
  tienda: string | null
  descripcion: string | null
  confirmacion_positiva: boolean | null
  confianza: number
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

// ── Estado en memoria por conversación (reset al reiniciar) ───
// Guarda el último tracking analizado por lead_id esperando confirmación
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

// ── Funciones de utilidad ─────────────────────────────────────

/** Reemplaza variables {var} en un mensaje del config */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** Fuzzy match: compara similitud entre dos strings (Levenshtein) */
function similitud(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/\s/g, '')
  const s2 = b.toLowerCase().replace(/\s/g, '')
  if (s1 === s2) return 1
  const len = Math.max(s1.length, s2.length)
  if (len === 0) return 1
  let dist = 0
  const dp: number[][] = Array.from({ length: s1.length + 1 }, (_, i) =>
    Array.from({ length: s2.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      dist = s1[i - 1] === s2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + dist)
    }
  }
  return 1 - dp[s1.length][s2.length] / len
}

/** Detecta keywords en el texto del cliente */
function contieneKeyword(texto: string, keywords: string[]): boolean {
  const t = texto.toLowerCase()
  return keywords.some(k => t.includes(k.toLowerCase()))
}

// ── Buscar cliente en Supabase por teléfono o email ───────────

async function buscarCliente(kommoContactId: number): Promise<ClienteInfo | null> {
  const supabase = getSupabase()

  // Buscar en Kommo el contacto para obtener su teléfono/email
  const kommoRes = await fetch(
    `https://celadashopper.kommo.com/api/v4/contacts/${kommoContactId}?with=leads`,
    { headers: { Authorization: `Bearer ${process.env.KOMMO_API_TOKEN}` } }
  )
  if (!kommoRes.ok) return null

  const kommoContact = await kommoRes.json() as {
    name?: string
    custom_fields_values?: Array<{
      field_code: string
      values: Array<{ value: string }>
    }>
  }

  // Extraer teléfono y email del contacto en Kommo
  const campos = kommoContact.custom_fields_values ?? []
  let telefono: string | null = null
  let email: string | null = null

  for (const campo of campos) {
    if (campo.field_code === 'PHONE') {
      telefono = campo.values[0]?.value?.replace(/\D/g, '') ?? null
    }
    if (campo.field_code === 'EMAIL') {
      email = campo.values[0]?.value ?? null
    }
  }

  // Buscar en Supabase por teléfono o email
  if (telefono) {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla, email, whatsapp')
      .or(`whatsapp.ilike.%${telefono.slice(-10)}%,telefono.ilike.%${telefono.slice(-10)}%`)
      .eq('activo', true)
      .maybeSingle()
    if (data) return data as ClienteInfo
  }

  if (email) {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla, email, whatsapp')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle()
    if (data) return data as ClienteInfo
  }

  return null
}

// ── Obtener paquetes activos del cliente ───────────────────────

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
  clienteId: string,
  casilla: string,
  tracking: string,
  tienda: string,
  descripcion: string
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

// ── Analizar mensaje con Claude ───────────────────────────────

async function analizarMensaje(texto: string): Promise<ClaudeAnalysis> {
  const anthropic = getAnthropic()

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Haiku: rápido y económico para análisis
      max_tokens: 256,
      system: BOT_CONFIG.promptSistema,
      messages: [{ role: 'user', content: texto }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    return JSON.parse(jsonMatch[0]) as ClaudeAnalysis
  } catch {
    return {
      intencion: 'otro',
      tracking: null,
      tienda: null,
      descripcion: null,
      confirmacion_positiva: null,
      confianza: 0,
    }
  }
}

// ── Enviar mensaje por Kommo API ──────────────────────────────
// Estrategia (en orden de prioridad):
// 1. POST /api/v4/chats/{uuid}/messages (body objeto JSON)
// 2. POST /api/v4/talks/{numeric}/reply  (endpoint alternativo)
// 3. POST /api/v4/chats/{uuid}/messages (body array)
// 4. POST /api/v4/leads/{id}/talks       (crear/continuar talk)
// 5. POST nota CRM como fallback visible

async function logChatInfo(chatId: string, authHeader: string): Promise<void> {
  try {
    const r = await fetch(`https://celadashopper.kommo.com/api/v4/chats/${chatId}`, {
      headers: { Authorization: authHeader },
    })
    const body = await r.text()
    console.log(`[bot] GET chat/${chatId}: status=${r.status} body=${body.slice(0, 400)}`)
  } catch (e) {
    console.log(`[bot] GET chat info error: ${e}`)
  }
}

export async function enviarMensajeKommo(
  leadId: number,
  texto: string,
  talkId?: string,
  chatId?: string,
  contactId?: number
): Promise<void> {
  const token = process.env.KOMMO_API_TOKEN
  const authHeader = `Bearer ${token}`
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  }

  console.log(`[bot] enviar → lead=${leadId} talk=${talkId} chat=${chatId} contact=${contactId}`)

  // ── Diagnóstico rápido: ver qué devuelve GET /chats/{uuid} ──────────────
  if (chatId) {
    await logChatInfo(chatId, authHeader)
  }

  // ── Intento 1: POST /chats/{uuid}/messages con body OBJETO ──────────────
  if (chatId) {
    const body1 = JSON.stringify({ text: texto })
    const r1 = await fetch(
      `https://celadashopper.kommo.com/api/v4/chats/${chatId}/messages`,
      { method: 'POST', headers, body: body1 }
    )
    const t1 = await r1.text()
    console.log(`[bot] chats/obj → ${r1.status}: ${t1.slice(0, 300)}`)
    if (r1.ok) return
  }

  // ── Intento 2: POST /chats/{uuid}/messages con body ARRAY ───────────────
  if (chatId) {
    const body2 = JSON.stringify([{ text: texto }])
    const r2 = await fetch(
      `https://celadashopper.kommo.com/api/v4/chats/${chatId}/messages`,
      { method: 'POST', headers, body: body2 }
    )
    const t2 = await r2.text()
    console.log(`[bot] chats/arr → ${r2.status}: ${t2.slice(0, 300)}`)
    if (r2.ok) return
  }

  // ── Intento 3: POST /talks/{numeric}/messages con body OBJETO ───────────
  if (talkId) {
    const body3 = JSON.stringify({ text: texto })
    const r3 = await fetch(
      `https://celadashopper.kommo.com/api/v4/talks/${talkId}/messages`,
      { method: 'POST', headers, body: body3 }
    )
    const t3 = await r3.text()
    console.log(`[bot] talks/obj → ${r3.status}: ${t3.slice(0, 300)}`)
    if (r3.ok) return
  }

  // ── Intento 4: POST /leads/{id}/talks (crear mensaje saliente en talk) ───
  if (talkId || chatId) {
    const body4 = JSON.stringify({
      talk_id: talkId ? parseInt(talkId) : undefined,
      chat_id: chatId,
      text: texto,
    })
    const r4 = await fetch(
      `https://celadashopper.kommo.com/api/v4/leads/${leadId}/talks`,
      { method: 'POST', headers, body: body4 }
    )
    const t4 = await r4.text()
    console.log(`[bot] leads/talks → ${r4.status}: ${t4.slice(0, 300)}`)
    if (r4.ok) return
  }

  // ── Intento 5: nota CRM (visible en Kommo, NO llega al cliente por WA) ──
  const noteBody = JSON.stringify([{
    note_type: 'common',
    params: { text: `🤖 BOT (envío WA pendiente): ${texto}` },
  }])
  const rNote = await fetch(
    `https://celadashopper.kommo.com/api/v4/leads/${leadId}/notes`,
    { method: 'POST', headers, body: noteBody }
  )
  if (rNote.ok) {
    console.warn(`[bot] ⚠️ Solo nota CRM (no WhatsApp) lead=${leadId}. Revisar logs para corregir endpoint.`)
  } else {
    console.error(`[bot] ❌ Hasta nota falló lead=${leadId}:`, await rNote.text())
  }
}

// ── Motor principal: procesar un mensaje entrante ─────────────

export async function procesarMensaje(msg: KommoMessage): Promise<void> {
  const { lead_id, contact_id, talk_id, chat_id, text, author_type, author_id } = msg

  // 1. Ignorar mensajes propios del bot/agentes para evitar loops
  if (author_type === 'user') return
  if (author_id === BOT_CONFIG.config.kommoUserId) return

  const texto = text?.trim()
  if (!texto || texto.length < 2) return

  console.log(`[bot] Mensaje lead ${lead_id} talk ${talk_id}: "${texto.slice(0, 80)}"`)

  // Helper: enviar respuesta probando todos los canales disponibles
  const enviar = (respuesta: string) => enviarMensajeKommo(lead_id, respuesta, talk_id, chat_id, contact_id)

  // 2. Buscar cliente en Supabase
  const cliente = await buscarCliente(contact_id)

  // 3. Detectar keywords rápidas (sin gastar API de Claude)
  if (contieneKeyword(texto, BOT_CONFIG.escalarSiDice)) {
    await enviar(BOT_CONFIG.mensajes.escalarHumano)
    return
  }

  // 4. Verificar si hay un tracking pendiente de confirmación
  const pendiente = pendienteConfirmacion.get(lead_id)
  const hace5min = Date.now() - 5 * 60 * 1000

  if (pendiente && pendiente.timestamp > hace5min) {
    const analisis = await analizarMensaje(texto)

    if (analisis.intencion === 'confirmacion' && analisis.confirmacion_positiva) {
      if (cliente) {
        const ok = await crearPreAlerta(
          cliente.id,
          cliente.numero_casilla,
          pendiente.tracking,
          pendiente.tienda,
          pendiente.descripcion
        )
        if (ok) {
          pendienteConfirmacion.delete(lead_id)
          await enviar(render(BOT_CONFIG.mensajes.trackingGuardado, {
            tracking: pendiente.tracking,
            tienda: pendiente.tienda || 'No especificada',
          }))
          return
        }
      }
    } else if (analisis.intencion === 'confirmacion' && analisis.confirmacion_positiva === false) {
      pendienteConfirmacion.delete(lead_id)
      await enviar(BOT_CONFIG.mensajes.trackingCancelado)
      return
    }
  }

  // 5. Keywords rápidas para ver paquetes y casilla
  if (contieneKeyword(texto, BOT_CONFIG.verPaquetesSiDice)) {
    if (!cliente) {
      await enviar(BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    const paquetes = await getPaquetesCliente(cliente.id)
    if (paquetes.length === 0) {
      await enviar(BOT_CONFIG.mensajes.sinPaquetes)
      return
    }
    const lista = paquetes.map(p => render(BOT_CONFIG.mensajes.unPaquete, {
      tracking: p.tracking_casilla,
      tienda: p.tienda,
      estado: ESTADO_TEXTO[p.estado] ?? p.estado,
      costo: p.factura_pagada ? '✅ Pagado' : `$${p.costo_servicio} USD pendiente`,
      fecha: new Date(p.updated_at).toLocaleDateString('es-CO'),
    })).join('\n\n')
    await enviar(render(BOT_CONFIG.mensajes.paquetesActivos, { lista_paquetes: lista }))
    return
  }

  if (contieneKeyword(texto, BOT_CONFIG.casillaSiDice)) {
    if (!cliente) {
      await enviar(BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    await enviar(render(BOT_CONFIG.mensajes.casilla, {
      casilla: cliente.numero_casilla,
      direccion_bodega: process.env.CELADASHOPPER_USA_ADDRESS ?? '8164 NW 108TH PL, Doral, FL 33178',
    }))
    return
  }

  // 6. Análisis Claude para trackings y otros
  const analisis = await analizarMensaje(texto)
  console.log(`[bot] Análisis:`, analisis)

  if (analisis.intencion === 'tracking' && analisis.tracking) {
    const tracking = analisis.tracking
    const tienda = analisis.tienda ?? 'No especificada'
    const descripcion = analisis.descripcion ?? 'Sin descripción'

    pendienteConfirmacion.set(lead_id, {
      tracking,
      tienda,
      descripcion,
      timestamp: Date.now(),
    })

    if (analisis.tienda || analisis.descripcion) {
      await enviar(render(BOT_CONFIG.mensajes.confirmacionTracking, { tracking, tienda, descripcion }))
    } else {
      await enviar(render(BOT_CONFIG.mensajes.confirmacionTrackingSolo, { tracking }))
    }
    return
  }

  if (analisis.intencion === 'ver_paquetes') {
    if (!cliente) {
      await enviar(BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    const paquetes = await getPaquetesCliente(cliente.id)
    if (paquetes.length === 0) {
      await enviar(BOT_CONFIG.mensajes.sinPaquetes)
      return
    }
    const lista = paquetes.map(p => render(BOT_CONFIG.mensajes.unPaquete, {
      tracking: p.tracking_casilla,
      tienda: p.tienda,
      estado: ESTADO_TEXTO[p.estado] ?? p.estado,
      costo: p.factura_pagada ? '✅ Pagado' : `$${p.costo_servicio} USD pendiente`,
      fecha: new Date(p.updated_at).toLocaleDateString('es-CO'),
    })).join('\n\n')
    await enviar(render(BOT_CONFIG.mensajes.paquetesActivos, { lista_paquetes: lista }))
    return
  }

  if (analisis.intencion === 'escalar') {
    await enviar(BOT_CONFIG.mensajes.escalarHumano)
    return
  }

  // 7. Primer contacto sin cliente registrado
  if (!cliente) {
    await enviar(BOT_CONFIG.mensajes.pedirNombre)
    return
  }

  // 8. No entendió
  await enviar(render(BOT_CONFIG.mensajes.noEntendi, {
    nombre: cliente.nombre_completo.split(' ')[0],
  }))
}
