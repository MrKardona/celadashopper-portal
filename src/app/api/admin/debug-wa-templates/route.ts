import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.META_WA_TOKEN
  const phoneId = process.env.META_WA_PHONE_ID

  if (!token) return NextResponse.json({ error: 'META_WA_TOKEN no configurado' }, { status: 500 })
  if (!phoneId) return NextResponse.json({ error: 'META_WA_PHONE_ID no configurado' }, { status: 500 })

  try {
    // 1. Verificar qué número de teléfono es el META_WA_PHONE_ID
    const phoneRes = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}?fields=verified_name,display_phone_number,quality_rating,status,name_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const phoneData = await phoneRes.json() as {
      verified_name?: string
      display_phone_number?: string
      quality_rating?: string
      status?: string
      name_status?: string
      error?: { message: string; code: number }
    }

    // 2. Listar templates del WABA
    const wabaId = '114659381735674'
    const tmplRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&fields=name,language,status,category,components`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const tmplData = await tmplRes.json() as {
      data?: { name: string; language: string; status: string; category: string; components?: unknown[] }[]
      error?: { message: string; code: number }
    }

    const csTemplates = tmplData.data?.filter(t => t.name.startsWith('cs_')) ?? []

    return NextResponse.json({
      phone_id_usado: phoneId,
      phone_info: phoneData,
      waba_templates_error: tmplData.error ?? null,
      cs_templates: csTemplates,
      all_template_names: tmplData.data?.map(t => `${t.name} (${t.language}) [${t.status}]`) ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
