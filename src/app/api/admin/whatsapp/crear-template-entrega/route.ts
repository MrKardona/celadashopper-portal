// POST /api/admin/whatsapp/crear-template-entrega
// Crea el template cs_entregado_con_foto en Meta con header IMAGE variable.
// Flujo:
//   1. Obtiene el WABA ID a partir del PHONE_ID (Graph API)
//   2. Envía la definición del template a Meta
//   3. Devuelve el status y el ID asignado por Meta

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const TEMPLATE_NAME = 'cs_entregado_con_foto'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getWabaId(): Promise<string> {
  const phoneId = process.env.META_WA_PHONE_ID!
  const token   = process.env.META_WA_TOKEN!

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}?fields=whatsapp_business_account&access_token=${token}`
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No se pudo obtener WABA ID: ${res.status} ${err.slice(0, 300)}`)
  }
  const data = await res.json() as {
    whatsapp_business_account?: { id?: string }
  }
  const wabaId = data.whatsapp_business_account?.id
  if (!wabaId) throw new Error('WABA ID no encontrado en la respuesta de Meta')
  return wabaId
}

export async function POST(req: NextRequest) {
  // Solo admins
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const phoneId = process.env.META_WA_PHONE_ID
  const token   = process.env.META_WA_TOKEN
  if (!phoneId || !token) {
    return NextResponse.json({ error: 'META_WA_PHONE_ID / META_WA_TOKEN no configurados' }, { status: 500 })
  }

  try {
    // 1. Obtener WABA ID
    const wabaId = await getWabaId()
    console.log('[crear-template] WABA ID:', wabaId)

    // 2. Definición del template
    const templateBody = {
      name: TEMPLATE_NAME,
      category: 'UTILITY',
      language: 'es',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
        },
        {
          type: 'BODY',
          text: '✅ ¡Hola {{1}}! Tu paquete fue entregado exitosamente 🎊\n📦 *{{2}}*\n📸 Te enviamos la foto como comprobante de entrega.',
        },
      ],
    }

    // 3. Crear el template en Meta
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateBody),
      }
    )

    const raw = await res.text()
    let data: Record<string, unknown>
    try { data = JSON.parse(raw) } catch { data = { raw } }

    if (!res.ok) {
      console.error('[crear-template] Meta error:', raw.slice(0, 500))
      return NextResponse.json({
        ok: false,
        status: res.status,
        meta_error: data,
      }, { status: 400 })
    }

    console.log('[crear-template] Template creado:', data)
    return NextResponse.json({
      ok: true,
      waba_id: wabaId,
      template_name: TEMPLATE_NAME,
      meta_response: data,
      nota: 'El template puede tardar minutos/horas en ser aprobado por Meta. Cuando el status sea APPROVED, actívalo en el código cambiando headerImagen a true.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[crear-template] Error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET — consulta el status del template en Meta
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const token = process.env.META_WA_TOKEN
  if (!token) return NextResponse.json({ error: 'META_WA_TOKEN no configurado' }, { status: 500 })

  try {
    const wabaId = await getWabaId()
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?name=${TEMPLATE_NAME}&fields=name,status,category,language,components`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, waba_id: wabaId, template_name: TEMPLATE_NAME, ...data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
