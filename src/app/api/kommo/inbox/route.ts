// src/app/api/kommo/inbox/route.ts
// Webhook receptor de mensajes entrantes de Kommo → procesa con bot

import { NextRequest, NextResponse } from 'next/server'
import { procesarMensaje, type KommoMessage } from '@/lib/bot/engine'

export const dynamic = 'force-dynamic'

// Tipos del payload de webhook de Kommo (add_message)
interface KommoWebhookPayload {
  message?: {
    add?: Array<{
      id?: string
      talk_id?: string
      contact_id?: number
      lead_id?: number
      text?: string
      author?: {
        id?: number
        type?: string  // 'contact' | 'user'
      }
      created_at?: number
    }>
  }
  // Kommo también puede enviar en formato de form-urlencoded
  // En ese caso viene como campos planos
}

function extractMessages(body: KommoWebhookPayload): KommoMessage[] {
  const msgs: KommoMessage[] = []
  const adds = body?.message?.add ?? []

  for (const m of adds) {
    if (!m.text || !m.lead_id) continue
    msgs.push({
      lead_id: m.lead_id,
      contact_id: m.contact_id ?? 0,
      talk_id: m.talk_id,
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

  try {
    if (contentType.includes('application/json')) {
      body = await req.json() as KommoWebhookPayload
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Kommo a veces envía form-urlencoded
      const text = await req.text()
      const params = new URLSearchParams(text)

      // Reconstruir estructura desde los params de Kommo
      // Formato: message[add][0][text]=..., message[add][0][lead_id]=...
      const leadId = params.get('message[add][0][lead_id]')
      const contactId = params.get('message[add][0][contact_id]')
      const msgText = params.get('message[add][0][text]')
      const authorId = params.get('message[add][0][author_id]')
      const authorType = params.get('message[add][0][author_type]') ?? 'contact'
      const talkId = params.get('message[add][0][talk_id]') ?? undefined

      if (leadId && msgText) {
        body = {
          message: {
            add: [{
              lead_id: parseInt(leadId),
              contact_id: contactId ? parseInt(contactId) : 0,
              text: msgText,
              author: {
                id: authorId ? parseInt(authorId) : 0,
                type: authorType,
              },
              talk_id: talkId,
            }],
          },
        }
      } else {
        body = {}
      }
    } else {
      body = await req.json().catch(() => ({})) as KommoWebhookPayload
    }
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Responder a Kommo inmediatamente (tiene timeout de ~5s)
  // Procesar en background sin bloquear la respuesta
  const messages = extractMessages(body)

  if (messages.length > 0) {
    // Fire-and-forget: no esperamos a que termine para responder a Kommo
    Promise.all(
      messages.map(m =>
        procesarMensaje(m).catch(err =>
          console.error(`[kommo/inbox] Error procesando mensaje lead ${m.lead_id}:`, err)
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
