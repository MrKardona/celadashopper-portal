// src/app/api/whatsapp/webhook/route.ts
// Recibe webhooks de Kommo CRM y delega a Supabase Edge Function

import { NextRequest, NextResponse, after } from 'next/server'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const contentType = req.headers.get('content-type') || ''

  console.log('[Webhook] Received POST', {
    contentType,
    bodyLength: rawBody.length,
    headers: Object.fromEntries(req.headers.entries()),
  })

  // Kommo puede enviar JSON o form-encoded — manejamos ambos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any = {}

  try {
    if (contentType.includes('application/json')) {
      payload = JSON.parse(rawBody)
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Kommo envía form-encoded: message[add][0][id]=...
      const params = new URLSearchParams(rawBody)
      payload = parseFormPayload(params)
    } else {
      // Intentar JSON de todos modos
      try {
        payload = JSON.parse(rawBody)
      } catch {
        const params = new URLSearchParams(rawBody)
        payload = parseFormPayload(params)
      }
    }
  } catch (err) {
    console.error('[Webhook] Failed to parse body:', err)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  console.log('[Webhook] Parsed payload:', JSON.stringify(payload).slice(0, 500))

  // Detectar mensajes entrantes de clientes
  const mensajesEntrantes = payload.message?.add?.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.author_type === 'contact' || m.type === 'incoming'
  ) ?? []

  if (mensajesEntrantes.length === 0) {
    console.log('[Webhook] No incoming messages, skipping')
    return NextResponse.json({ ok: true })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  console.log('[Webhook] Calling Edge Function for message:', mensajesEntrantes[0])

  // Usar after() para garantizar que el fetch se complete aunque respondamos 200 primero
  // Esto resuelve el problema de fire-and-forget en serverless (fetch cancelado al terminar)
  after(async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/process-whatsapp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mensaje: mensajesEntrantes[0],
          account: payload.account ?? {},
        }),
      })
      console.log('[Webhook] Edge Function responded:', res.status)
    } catch (err) {
      console.error('[Webhook] Edge Function call failed:', err)
    }
  })

  return NextResponse.json({ ok: true })
}

// Convierte el formato form-encoded de Kommo a objeto JSON
// Ej: message[add][0][id]=123 → { message: { add: [{ id: '123' }] } }
function parseFormPayload(params: URLSearchParams): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}
  for (const [key, value] of params.entries()) {
    const parts = key.replace(/\]/g, '').split('[')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = result
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      const nextPart = parts[i + 1]
      const isNextIndex = /^\d+$/.test(nextPart)
      // Si current es array, usar índice numérico real (no string)
      const idx: string | number = Array.isArray(current) ? parseInt(part, 10) : part
      if (current[idx] === undefined) {
        current[idx] = isNextIndex ? [] : {}
      }
      current = current[idx]
    }
    const lastPart = parts[parts.length - 1]
    if (Array.isArray(current)) {
      current.push(value)
    } else {
      // Si current es array accedido por índice numérico, usar parseInt
      const lastIdx: string | number = Array.isArray(current) ? parseInt(lastPart, 10) : lastPart
      current[lastIdx] = value
    }
  }
  return result
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
