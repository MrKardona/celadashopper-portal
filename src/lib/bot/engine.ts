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
  talk_id?: string
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

export async function enviarMensajeKommo(leadId: number, texto: string): Promise<void> {
  // Intentar enviar como mensaje del chat (sale por WhatsApp)
  const res = await fetch(
    `https://celadashopper.kommo.com/api/v4/leads/${leadId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KOMMO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texto }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error(`[bot] Error enviando mensaje Kommo lead ${leadId}:`, err)
    // Fallback: agregar como nota visible en el lead
    await fetch(
      `https://celadashopper.kommo.com/api/v4/leads/${leadId}/notes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.KOMMO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note_type: 'common',
          params: { text: `[BOT] ${texto}` },
        }),
      }
    )
  }
}

// ── Motor principal: procesar un mensaje entrante ─────────────

export async function procesarMensaje(msg: KommoMessage): Promise<void> {
  const { lead_id, contact_id, text, author_type, author_id } = msg

  // 1. Ignorar mensajes propios del bot/agentes para evitar loops
  if (author_type === 'user') return
  if (author_id === BOT_CONFIG.config.kommoUserId) return

  const texto = text?.trim()
  if (!texto || texto.length < 2) return

  console.log(`[bot] Mensaje lead ${lead_id}: "${texto.slice(0, 80)}"`)

  // 2. Buscar cliente en Supabase
  const cliente = await buscarCliente(contact_id)

  // 3. Detectar keywords rápidas (sin gastar API de Claude)
  if (contieneKeyword(texto, BOT_CONFIG.escalarSiDice)) {
    await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.escalarHumano)
    return
  }

  // 4. Verificar si hay un tracking pendiente de confirmación
  const pendiente = pendienteConfirmacion.get(lead_id)
  const hace5min = Date.now() - 5 * 60 * 1000

  if (pendiente && pendiente.timestamp > hace5min) {
    // El cliente está respondiendo a una solicitud de confirmación
    const analisis = await analizarMensaje(texto)

    if (analisis.intencion === 'confirmacion' && analisis.confirmacion_positiva) {
      // Confirma → guardar pre-alerta
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
          await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.trackingGuardado, {
            tracking: pendiente.tracking,
            tienda: pendiente.tienda || 'No especificada',
          }))
          return
        }
      }
    } else if (analisis.intencion === 'confirmacion' && analisis.confirmacion_positiva === false) {
      // Cancela
      pendienteConfirmacion.delete(lead_id)
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.trackingCancelado)
      return
    }
    // Si no fue una confirmación clara, continúa con análisis normal
  }

  // 5. Keywords rápidas para ver paquetes y casilla
  if (contieneKeyword(texto, BOT_CONFIG.verPaquetesSiDice)) {
    if (!cliente) {
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    const paquetes = await getPaquetesCliente(cliente.id)
    if (paquetes.length === 0) {
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.sinPaquetes)
      return
    }
    const lista = paquetes.map(p => render(BOT_CONFIG.mensajes.unPaquete, {
      tracking: p.tracking_casilla,
      tienda: p.tienda,
      estado: ESTADO_TEXTO[p.estado] ?? p.estado,
      costo: p.factura_pagada ? '✅ Pagado' : `$${p.costo_servicio} USD pendiente`,
      fecha: new Date(p.updated_at).toLocaleDateString('es-CO'),
    })).join('\n\n')
    await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.paquetesActivos, { lista_paquetes: lista }))
    return
  }

  if (contieneKeyword(texto, BOT_CONFIG.casillaSiDice)) {
    if (!cliente) {
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.casilla, {
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

    // Guardar en memoria esperando confirmación
    pendienteConfirmacion.set(lead_id, {
      tracking,
      tienda,
      descripcion,
      timestamp: Date.now(),
    })

    if (analisis.tienda || analisis.descripcion) {
      // Tenemos suficiente info → pedir confirmación completa
      await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.confirmacionTracking, {
        tracking,
        tienda,
        descripcion,
      }))
    } else {
      // Solo tenemos el tracking → pedir más info
      await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.confirmacionTrackingSolo, {
        tracking,
      }))
    }
    return
  }

  if (analisis.intencion === 'ver_paquetes') {
    if (!cliente) {
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.clienteNoEncontrado)
      return
    }
    const paquetes = await getPaquetesCliente(cliente.id)
    if (paquetes.length === 0) {
      await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.sinPaquetes)
      return
    }
    const lista = paquetes.map(p => render(BOT_CONFIG.mensajes.unPaquete, {
      tracking: p.tracking_casilla,
      tienda: p.tienda,
      estado: ESTADO_TEXTO[p.estado] ?? p.estado,
      costo: p.factura_pagada ? '✅ Pagado' : `$${p.costo_servicio} USD pendiente`,
      fecha: new Date(p.updated_at).toLocaleDateString('es-CO'),
    })).join('\n\n')
    await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.paquetesActivos, { lista_paquetes: lista }))
    return
  }

  if (analisis.intencion === 'escalar') {
    await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.escalarHumano)
    return
  }

  // 7. Primer contacto sin cliente registrado
  if (!cliente) {
    await enviarMensajeKommo(lead_id, BOT_CONFIG.mensajes.pedirNombre)
    return
  }

  // 8. No entendió
  await enviarMensajeKommo(lead_id, render(BOT_CONFIG.mensajes.noEntendi, {
    nombre: cliente.nombre_completo.split(' ')[0],
  }))
}
