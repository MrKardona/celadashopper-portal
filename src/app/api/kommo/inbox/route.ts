// src/app/api/kommo/inbox/route.ts
// Webhook receptor de mensajes entrantes de Kommo → procesa con bot

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { procesarMensaje, type KommoMessage } from '@/lib/bot/engine'

export const dynamic = 'force-dynamic'

// Tipos del payload de webhook de Kommo (add_message)
// Nota: en form-urlencoded, el lead ID viene como element_id (element_type=2)
interface KommoWebhookPayload {
  message?: {
    add?: Array<{
      id?: string
      chat_id?: string   // UUID para enviar por WhatsApp (form-urlencoded: chat_id)
      talk_id?: string   // ID numérico legacy (no usar para envío)
      contact_id?: number
      lead_id?: number   // en JSON directo
      element_id?: number // en form-urlencoded (element_type=2 significa lead)
      element_type?: number
      text?: string
      author?: {
        id?: number
        type?: string  // 'contact' | 'user'
      }
      created_at?: number
    }>
  }
}

function extractMessages(body: KommoWebhookPayload): KommoMessage[] {
  const msgs: KommoMessage[] = []
  const adds = body?.message?.add ?? []

  for (const m of adds) {
    // lead_id viene en JSON directo; element_id viene en form-urlencoded
    const leadId = m.lead_id ?? m.element_id
    if (!m.text || !leadId) continue
    msgs.push({
      lead_id: leadId,
      contact_id: m.contact_id ?? 0,
      talk_id: m.talk_id,    // ID numérico de la conversación
      chat_id: m.chat_id,    // UUID del canal WhatsApp
      text: m.text,
      author_type: m.author?.type ?? 'contact',
      author_id: m.author?.id ?? 0,
    })
  }
  return msgs
}

export async function POST(req: NextRequest) {
  let body: KommoWebhookPayload

  const contentType = req.headers.get('content-type') ?? ''

  // Leer el body crudo siempre para poder loggearlo
  const rawText = await req.text()
  console.log(`[kommo/inbox] Content-Type: "${contentType}" | Body (300c): ${rawText.slice(0, 300)}`)

  try {
    if (contentType.includes('application/json')) {
      body = JSON.parse(rawText) as KommoWebhookPayload
    } else if (contentType.includes('application/x-www-form-urlencoded') || rawText.includes('%5B') || rawText.includes('[')) {
      // Kommo envía form-urlencoded (con o sin content-type correcto)
      const params = new URLSearchParams(rawText)

      // Log de todos los params para debugging
      const allParams: Record<string, string> = {}
      params.forEach((v, k) => { allParams[k] = v })
      console.log('[kommo/inbox] Params recibidos:', JSON.stringify(allParams).slice(0, 500))

      // Kommo envía element_id (lead ID) + element_type=2, no lead_id directamente
      const elementId = params.get('message[add][0][element_id]') ?? params.get('message[add][0][lead_id]')
      const contactId = params.get('message[add][0][contact_id]')
      const msgText = params.get('message[add][0][text]')
      const authorId = params.get('message[add][0][author_id]')
      const authorType = params.get('message[add][0][author_type]') ?? 'contact'
      // talk_id = ID numérico de la conversación activa
      // chat_id = UUID del canal WhatsApp
      const talkIdNumerico = params.get('message[add][0][talk_id]') ?? undefined
      const chatIdUUID = params.get('message[add][0][chat_id]') ?? undefined

      if (elementId && msgText) {
        body = {
          message: {
            add: [{
              element_id: parseInt(elementId),
              contact_id: contactId ? parseInt(contactId) : 0,
              text: msgText,
              author: {
                id: authorId ? parseInt(authorId) : 0,
                type: authorType,
              },
              talk_id: talkIdNumerico,
              chat_id: chatIdUUID,
            }],
          },
        }
      } else {
        console.log('[kommo/inbox] Form sin element_id+text. elementId:', elementId, '| text:', msgText)
        body = {}
      }
    } else {
      // Intentar parsear como JSON de todos modos
      try {
        body = JSON.parse(rawText) as KommoWebhookPayload
      } catch {
        body = {}
      }
    }
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Responder a Kommo inmediatamente (tiene timeout de ~5s)
  // Procesar en background sin bloquear la respuesta
  const messages = extractMessages(body)

  if (messages.length > 0) {
    // waitUntil: responde a Kommo de inmediato pero garantiza que el procesamiento complete
    waitUntil(
      Promise.all(
        messages.map(m =>
          procesarMensaje(m).catch(err =>
            console.error(`[kommo/inbox] Error procesando mensaje lead ${m.lead_id}:`, err)
          )
        )
      )
    )
  } else {
    console.log('[kommo/inbox] Webhook recibido sin mensajes de texto:', JSON.stringify(body).slice(0, 200))
  }

  // Kommo espera un 200 OK
  return new NextResponse('OK', { status: 200 })
}

// GET para verificar que el endpoint está activo
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'kommo-inbox-bot',
    timestamp: new Date().toISOString(),
  })
}
