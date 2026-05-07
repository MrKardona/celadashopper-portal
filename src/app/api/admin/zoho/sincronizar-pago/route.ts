// POST /api/admin/zoho/sincronizar-pago
// Consulta Zoho Inventory para obtener el estado actual de la factura y
// actualiza factura_pagada en la BD si el estado es "paid".

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
      client_id:     process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`Zoho token error: ${data.error ?? JSON.stringify(data)}`)
  return data.access_token
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { paquete_id } = await req.json() as { paquete_id: string }
  if (!paquete_id) return NextResponse.json({ error: 'Falta paquete_id' }, { status: 400 })

  const { data: paquete } = await admin.from('paquetes').select('factura_id, factura_pagada').eq('id', paquete_id).single()
  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  if (!paquete.factura_id) return NextResponse.json({ error: 'Este paquete no tiene factura en Zoho' }, { status: 400 })

  const orgId = process.env.ZOHO_ORG_ID
  if (!orgId || !process.env.ZOHO_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Zoho no configurado' }, { status: 503 })
  }

  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://www.zohoapis.com/inventory/v1/invoices/${paquete.factura_id}?organization_id=${orgId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    )
    const rawText = await res.text()
    console.log('[sincronizar-pago] Zoho raw response:', rawText.slice(0, 500))

    let data: Record<string, unknown>
    try {
      data = JSON.parse(rawText) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: `Zoho devolvió respuesta no-JSON (HTTP ${res.status}): ${rawText.slice(0, 200)}` }, { status: 500 })
    }

    // Zoho puede devolver { invoice: {...} } o { code: N, message: '...' } en error
    if (data.code !== undefined && data.code !== 0) {
      return NextResponse.json({ error: `Zoho error ${data.code}: ${data.message ?? rawText.slice(0, 200)}` }, { status: 502 })
    }

    const invoice = data.invoice as { status?: string; balance?: number; total?: number } | undefined
    if (!invoice?.status) {
      return NextResponse.json({ error: `Respuesta inesperada de Zoho: ${rawText.slice(0, 300)}` }, { status: 502 })
    }

    const zohoStatus = invoice.status  // 'draft' | 'sent' | 'viewed' | 'paid' | 'void' | 'overdue'
    const esPagada = zohoStatus === 'paid'

    if (esPagada !== paquete.factura_pagada) {
      await admin.from('paquetes').update({ factura_pagada: esPagada, updated_at: new Date().toISOString() }).eq('id', paquete_id)
    }

    return NextResponse.json({ ok: true, status: zohoStatus, factura_pagada: esPagada, actualizado: esPagada !== paquete.factura_pagada })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al consultar Zoho' }, { status: 500 })
  }
}
