import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.META_WA_TOKEN
  const phoneId = process.env.META_WA_PHONE_ID

  if (!token) return NextResponse.json({ error: 'META_WA_TOKEN no configurado' }, { status: 500 })

  // WABA ID obtenido de Meta Business Manager (asset_id=114659381735674)
  const wabaId = '1584920119301422'

  try {
    // 1. Listar templates del WABA
    const tmplRes = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&fields=name,language,status,category`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const tmplData = await tmplRes.json() as {
      data?: { name: string; language: string; status: string; category: string }[]
      error?: { message: string; code: number }
    }

    if (tmplData.error) {
      // 2. Si falla con WABA ID, intentar con el phone ID para obtener el WABA correcto
      const phoneRes = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}?fields=verified_name,display_phone_number`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const phoneData = await phoneRes.json()
      return NextResponse.json({
        wabaId_tried: wabaId,
        waba_error: tmplData.error,
        phone_info: phoneData,
        META_WA_PHONE_ID: phoneId,
      })
    }

    const csTemplates = tmplData.data?.filter(t => t.name.startsWith('cs_')) ?? []
    const allTemplates = tmplData.data ?? []

    return NextResponse.json({
      wabaId,
      META_WA_PHONE_ID: phoneId,
      total_templates: allTemplates.length,
      cs_templates: csTemplates,
      all_template_names: allTemplates.map(t => `${t.name} (${t.language}) [${t.status}]`),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
