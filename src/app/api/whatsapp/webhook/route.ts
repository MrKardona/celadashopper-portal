// src/app/api/whatsapp/webhook/route.ts
// Recibe webhooks de Kommo CRM, verifica la firma y delega a Edge Function

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/kommo/client'
import type { KommoWebhookPayload } from '@/types'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-kommo-signature')
  const secret = process.env.KOMMO_WEBHOOK_SECRET!

  // 1. Verificar firma HMAC (seguridad)
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('Webhook signature verification failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: KommoWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Solo procesar mensajes entrantes de clientes
  const mensajesEntrantes = payload.message?.add?.filter(
    (m) => m.author_type === 'contact'
  )

  if (!mensajesEntrantes || mensajesEntrantes.length === 0) {
    return NextResponse.json({ ok: true })
  }

  // 3. Responder 200 INMEDIATAMENTE a Kommo (< 5 segundos requerido)
  // Disparar procesamiento asíncrono en Supabase Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Fire-and-forget: no esperamos la respuesta
  fetch(`${supabaseUrl}/functions/v1/process-whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mensaje: mensajesEntrantes[0],
      account: payload.account,
    }),
  }).catch((err) => console.error('Edge Function call failed:', err))

  return NextResponse.json({ ok: true })
}

// GET para verificación del webhook en Kommo (la primera vez que configuras)
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
