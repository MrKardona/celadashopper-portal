// src/lib/kommo/client.ts
// Cliente HTTP para Kommo CRM API
// Docs: https://developers.kommo.com/reference

import crypto from 'crypto'

const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN!
const KOMMO_API_TOKEN = process.env.KOMMO_API_TOKEN!
const BASE_URL = `https://${KOMMO_DOMAIN}.kommo.com/api/v4`

async function kommoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KOMMO_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kommo API error ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Envía un mensaje de texto al cliente por WhatsApp via Kommo Chats API
 * El chat_id identifica la conversación en Kommo (viene en el webhook)
 */
export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  await kommoFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ type: 'text', text }),
  })
}

/**
 * Obtiene los datos de un contacto de Kommo por su ID
 * Incluye el número de teléfono para matchear con Supabase
 */
export async function getContact(contactId: number): Promise<{
  id: number
  name: string
  phone?: string
}> {
  const data = await kommoFetch(`/contacts/${contactId}`)
  const phoneField = data.custom_fields_values?.find(
    (f: { field_code: string }) => f.field_code === 'PHONE'
  )
  const phone = phoneField?.values?.[0]?.value as string | undefined
  return { id: data.id, name: data.name, phone }
}

/**
 * Reasigna una conversación a un agente humano en Kommo
 * Agrega una nota con el contexto para que el agente entienda la situación
 */
export async function escalateToHuman(
  contactId: number,
  chatId: string,
  contextoEscalada: string
): Promise<void> {
  // Agregar nota al contacto con el contexto
  await kommoFetch(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({
      note_type: 'common',
      params: { text: `🤖 Escalada automática del agente IA:\n\n${contextoEscalada}` },
    }),
  })

  // Quitar asignación del bot (asignar a null para que un humano lo tome)
  await kommoFetch(`/chats/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify({ responsible_user_id: null }),
  })
}

/**
 * Verifica la firma HMAC del webhook de Kommo
 * Kommo envía X-Kommo-Signature: sha256=<hash>
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
