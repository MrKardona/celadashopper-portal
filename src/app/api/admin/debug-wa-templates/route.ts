import { NextResponse } from 'next/server'

export async function GET() {
  const phoneId = process.env.META_WA_PHONE_ID
  const token = process.env.META_WA_TOKEN

  if (!phoneId || !token) {
    return NextResponse.json({ error: 'META_WA_PHONE_ID o META_WA_TOKEN no configurados' }, { status: 500 })
  }

  try {
    // 1. Obtener info del número y su WABA
    const phoneRes = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}?fields=verified_name,display_phone_number,whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const phoneData = await phoneRes.json() as {
      verified_name?: string
      display_phone_number?: string
      whatsapp_business_account?: { id: string }
    }

    const wabaId = phoneData.whatsapp_business_account?.id
    if (!wabaId) {
      return NextResponse.json({ phoneData, error: 'No se pudo obtener WABA ID' })
    }

    // 2. Listar templates del WABA
    const tmplRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=50&fields=name,language,status,category`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const tmplData = await tmplRes.json() as {
      data?: { name: string; language: string; status: string; category: string }[]
    }

    // Filtrar solo los cs_ templates
    const csTemplates = tmplData.data?.filter(t => t.name.startsWith('cs_')) ?? []

    return NextResponse.json({
      phone: phoneData.display_phone_number,
      wabaId,
      cs_templates: csTemplates,
      total_templates: tmplData.data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
