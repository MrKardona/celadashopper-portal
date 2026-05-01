// src/app/api/kommo/debug/route.ts
// Endpoint de diagnóstico para investigar la API de Kommo
// GET /api/kommo/debug?chat_id=UUID&talk_id=NUMERIC&lead_id=NUMERIC

import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

async function kommoGet(path: string, token: string) {
  const url = `https://celadashopper.kommo.com/api/v4/${path}`
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.text()
    let parsed: unknown = body
    try { parsed = JSON.parse(body) } catch { /* keep text */ }
    return { url, status: r.status, body: parsed }
  } catch (e) {
    return { url, status: 0, body: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const token = process.env.KOMMO_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'KOMMO_API_TOKEN no configurado' }, { status: 500 })
  }

  const { searchParams } = req.nextUrl
  const chatId = searchParams.get('chat_id')
  const talkId = searchParams.get('talk_id')
  const leadId = searchParams.get('lead_id')
  const contactId = searchParams.get('contact_id')

  const results: Record<string, unknown> = {}

  // ── Info básica de la cuenta ──────────────────────────────────
  results.account = await kommoGet('account', token)

  // ── Lista de chats (primeros 10) ──────────────────────────────
  results.chats_list = await kommoGet('chats?limit=10', token)

  // ── Chat específico si se pasó chat_id ───────────────────────
  if (chatId) {
    results.chat_get = await kommoGet(`chats/${chatId}`, token)
    results.chat_messages = await kommoGet(`chats/${chatId}/messages?limit=5`, token)
  }

  // ── Talk específico si se pasó talk_id ───────────────────────
  if (talkId) {
    results.talk_get = await kommoGet(`talks/${talkId}`, token)
    results.talk_messages = await kommoGet(`talks/${talkId}/messages?limit=5`, token)
  }

  // ── Lead específico si se pasó lead_id ───────────────────────
  if (leadId) {
    results.lead_get = await kommoGet(`leads/${leadId}`, token)
    results.lead_talks = await kommoGet(`leads/${leadId}/talks`, token)
    results.lead_notes = await kommoGet(`leads/${leadId}/notes?limit=5`, token)
  }

  // ── Contacto específico si se pasó contact_id ────────────────
  if (contactId) {
    results.contact_get = await kommoGet(`contacts/${contactId}`, token)
  }

  // ── Intentar envío de prueba si se pasó chat_id ──────────────
  if (chatId && searchParams.get('send_test') === '1') {
    const testText = `[TEST BOT] Diagnóstico ${new Date().toISOString()}`
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Test A: POST chats/{uuid}/messages con objeto
    try {
      const ra = await fetch(`https://celadashopper.kommo.com/api/v4/chats/${chatId}/messages`, {
        method: 'POST', headers, body: JSON.stringify({ text: testText }),
      })
      results.test_chats_obj = { status: ra.status, body: await ra.text() }
    } catch (e) { results.test_chats_obj = { error: String(e) } }

    // Test B: POST chats/{uuid}/messages con array
    try {
      const rb = await fetch(`https://celadashopper.kommo.com/api/v4/chats/${chatId}/messages`, {
        method: 'POST', headers, body: JSON.stringify([{ text: testText }]),
      })
      results.test_chats_arr = { status: rb.status, body: await rb.text() }
    } catch (e) { results.test_chats_arr = { error: String(e) } }

    if (talkId) {
      // Test C: POST talks/{numeric}/messages con objeto
      try {
        const rc = await fetch(`https://celadashopper.kommo.com/api/v4/talks/${talkId}/messages`, {
          method: 'POST', headers, body: JSON.stringify({ text: testText }),
        })
        results.test_talks_obj = { status: rc.status, body: await rc.text() }
      } catch (e) { results.test_talks_obj = { error: String(e) } }
    }

    if (leadId) {
      // Test D: POST leads/{id}/talks
      try {
        const rd = await fetch(`https://celadashopper.kommo.com/api/v4/leads/${leadId}/talks`, {
          method: 'POST', headers,
          body: JSON.stringify({ chat_id: chatId, text: testText }),
        })
        results.test_leads_talks = { status: rd.status, body: await rd.text() }
      } catch (e) { results.test_leads_talks = { error: String(e) } }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
