import { NextResponse } from 'next/server'

// Prueba todos los language codes posibles para encontrar el correcto
export async function GET(request: Request) {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN

  if (!phoneId || !token) {
    return NextResponse.json({ error: 'META_WA_PHONE_ID o META_WA_TOKEN no configurados' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone') // número a probar, ej: 573225733195

  if (!phone) {
    return NextResponse.json({
      instrucciones: 'Agrega ?phone=57XXXXXXXXXX para probar todos los idiomas',
      ejemplo: '/api/admin/debug-wa-templates?phone=573225733195',
    })
  }

  const langCodes = ['es', 'es_ES', 'es_MX', 'es_AR', 'es_US', 'es_LA']
  const results: Record<string, { status: number; error?: string; ok?: boolean }> = {}

  for (const lang of langCodes) {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'cs_paquete_en_transito',
          language: { code: lang },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: 'Test' },
              { type: 'text', text: 'Paquete de prueba' },
            ],
          }],
        },
      }),
    })
    const raw = await res.json() as { error?: { message?: string; code?: number } }
    results[lang] = {
      status: res.status,
      ok: res.ok,
      error: raw.error?.message,
    }
    // Si funcionó, paramos
    if (res.ok) break
  }

  return NextResponse.json({ phone, results })
}
