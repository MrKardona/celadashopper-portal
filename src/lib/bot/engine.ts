// src/lib/bot/engine.ts
// Motor del bot — NO necesitas editar este archivo
// Lógica: analizar mensaje → Claude → Supabase → responder por Meta WhatsApp API

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
  intencion: 'tracking' | 'ver_paquetes' | 'casilla' | 'escalar' | 'confirmacion' | 'saludo' | 'como_funciona' | 'costo' | 'tiempo' | 'otro'
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

async function buscarCliente(kommoContactId: number): Promise<{ cliente: ClienteInfo | null; phone: string | null }> {
  const supabase = getSupabase()

  // Buscar en Kommo el contacto para obtener su teléfono/email
  const kommoRes = await fetch(
    `https://celadashopper.kommo.com/api/v4/contacts/${kommoContactId}?with=leads`,
    { headers: { Authorization: `Bearer ${process.env.KOMMO_API_TOKEN}` } }
  )
  if (!kommoRes.ok) return { cliente: null, phone: null }

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

// ── Enviar mensaje via Meta WhatsApp Cloud API ────────────────
// Requiere env: META_WA_PHONE_ID, META_WA_TOKEN
// El cliente debe haber enviado un mensaje primero (ventana de 24 h)

async function enviarPorMeta(phone: string, texto: string): Promise<boolean> {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    console.warn('[bot] META_WA_PHONE_ID o META_WA_TOKEN no configurados')
    return false
  }

  // Asegura formato internacional sin + (ej: 573206639554)
  const cleanPhone = phone.replace(/\D/g, '')

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: texto },
        }),
      }
    )

    const body = await res.text()
    if (res.ok) {
      console.log(`[bot] ✅ WhatsApp enviado via Meta API → ${cleanPhone}`)
      return true
    }
    console.warn(`[bot] ⚠️ Meta API falló (${res.status}): ${body.slice(0, 300)}`)
    return false
  } catch (e) {
    console.error('[bot] ❌ Meta API error:', e)
    return false
  }
}

// ── Fallback: nota CRM en Kommo (solo si Meta falla) ─────────
// No llega al cliente por WhatsApp, pero queda visible para agentes

async function enviarNotaKommo(leadId: number, texto: string): Promise<void> {
  const token = process.env.KOMMO_API_TOKEN
  const noteBody = JSON.stringify([{
    note_type: 'common',
    params: { text: `🤖 BOT: ${texto}` },
  }])
  const res = await fetch(
    `https://celadashopper.kommo.com/api/v4/leads/${leadId}/notes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: noteBody,
    }
  )
  if (res.ok) {
    console.warn(`[bot] ⚠️ Mensaje guardado solo como nota CRM (no WhatsApp) lead=${leadId}`)
  } else {
    console.error(`[bot] ❌ Nota CRM también falló lead=${leadId}:`, await res.text())
  }
}

// ── Escalar lead a asesor humano en Kommo ─────────────────────
// Mueve el lead a "Nueva consulta" y lo asigna al asesor configurado

async function escalarEnKommo(leadId: number): Promise<void> {
  const token = process.env.KOMMO_API_TOKEN
  const { kommoStatusEscalacion, kommoAsesorId } = BOT_CONFIG.config

  const res = await fetch('https://celadashopper.kommo.com/api/v4/leads', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      id: leadId,
      status_id: kommoStatusEscalacion,
      responsible_user_id: kommoAsesorId,
    }]),
  })

  if (res.ok) {
    console.log(`[bot] ✅ Lead ${leadId} escalado → etapa "Nueva consulta", asignado a asesor ${kommoAsesorId}`)
  } else {
    console.warn(`[bot] ⚠️ No se pudo mover el lead ${leadId} en Kommo (${res.status}):`, await res.text())
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

  // 2. Buscar cliente en Supabase (también obtiene el teléfono del contacto en Kommo)
  const { cliente, phone: waPhone } = await buscarCliente(contact_id)

  // Helper: envía via Meta WhatsApp API; si no tiene teléfono o falla, guarda nota CRM
  const enviar = async (respuesta: string) => {
    if (waPhone) {
      const ok = await enviarPorMeta(waPhone, respuesta)
      if (ok) return
    }
    await enviarNotaKommo(lead_id, respuesta)
  }

  // 3. Escalación por keywords (sin gastar Claude)
  if (contieneKeyword(texto, BOT_CONFIG.escalarSiDice)) {
    await enviar(BOT_CONFIG.mensajes.escalarHumano)
    await escalarEnKommo(lead_id)
    return
  }

  // 4. Keywords rápidas de costo, tiempo, cómo funciona (no necesitan cuenta)
  if (contieneKeyword(texto, BOT_CONFIG.costoSiDice)) {
    await enviar(BOT_CONFIG.mensajes.costoEnvio)
    return
  }

  if (contieneKeyword(texto, BOT_CONFIG.tiempoSiDice)) {
    await enviar(BOT_CONFIG.mensajes.tiempoEntrega)
    return
  }

  if (contieneKeyword(texto, BOT_CONFIG.comoFuncionaSiDice)) {
    await enviar(BOT_CONFIG.mensajes.comoFunciona)
    return
  }

  // 5. Verificar si hay un tracking pendiente de confirmación
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
      } else {
        // Tiene tracking pendiente pero no está registrado
        await enviar(BOT_CONFIG.mensajes.pedirIdentificacion)
        return
      }
    } else if (analisis.intencion === 'confirmacion' && analisis.confirmacion_positiva === false) {
      pendienteConfirmacion.delete(lead_id)
      await enviar(BOT_CONFIG.mensajes.trackingCancelado)
      return
    }
  }

  // 6. Keywords de paquetes y casilla
  if (contieneKeyword(texto, BOT_CONFIG.verPaquetesSiDice)) {
    if (!cliente) {
      await enviar(BOT_CONFIG.mensajes.pedirIdentificacion)
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
      await enviar(BOT_CONFIG.mensajes.pedirIdentificacion)
      return
    }
    await enviar(render(BOT_CONFIG.mensajes.casilla, {
      casilla: cliente.numero_casilla,
      direccion_bodega: process.env.CELADASHOPPER_USA_ADDRESS ?? '8164 NW 108TH PL, Doral, FL 33178',
    }))
    return
  }

  // 7. Análisis Claude para trackings, saludos y otros
  const analisis = await analizarMensaje(texto)
  console.log(`[bot] Análisis:`, analisis)

  // Saludo genérico o primer mensaje → bienvenida sin pedir datos
  if (analisis.intencion === 'saludo' || analisis.intencion === 'otro') {
    if (cliente) {
      await enviar(render(BOT_CONFIG.mensajes.bienvenidaConNombre, {
        nombre: cliente.nombre_completo.split(' ')[0],
      }))
    } else {
      await enviar(BOT_CONFIG.mensajes.bienvenida)
    }
    return
  }

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
      await enviar(BOT_CONFIG.mensajes.pedirIdentificacion)
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

  if (analisis.intencion === 'casilla') {
    if (!cliente) {
      await enviar(BOT_CONFIG.mensajes.pedirIdentificacion)
      return
    }
    await enviar(render(BOT_CONFIG.mensajes.casilla, {
      casilla: cliente.numero_casilla,
      direccion_bodega: process.env.CELADASHOPPER_USA_ADDRESS ?? '8164 NW 108TH PL, Doral, FL 33178',
    }))
    return
  }

  if (analisis.intencion === 'como_funciona') {
    await enviar(BOT_CONFIG.mensajes.comoFunciona)
    return
  }

  if (analisis.intencion === 'costo') {
    await enviar(BOT_CONFIG.mensajes.costoEnvio)
    return
  }

  if (analisis.intencion === 'tiempo') {
    await enviar(BOT_CONFIG.mensajes.tiempoEntrega)
    return
  }

  if (analisis.intencion === 'escalar') {
    await enviar(BOT_CONFIG.mensajes.escalarHumano)
    await escalarEnKommo(lead_id)
    return
  }

  // 8. No entendió — respuesta con menú
  await enviar(BOT_CONFIG.mensajes.noEntendi)
}
