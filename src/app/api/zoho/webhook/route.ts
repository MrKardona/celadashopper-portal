// POST /api/zoho/webhook
// Zoho Inventory llama este endpoint automáticamente cuando cambia el estado
// de una factura (ej: marcada como pagada).
//
// Para activarlo: en Zoho Inventory → Configuración → Webhooks → Nueva regla
// URL: https://tudominio.com/api/zoho/webhook
// Eventos: invoice.payment_made / invoice.updated

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

interface ZohoWebhookPayload {
  event_type?: string
  data?: {
    invoice?: {
      invoice_id?: string
      status?: string
      balance?: number
    }
  }
  // Formato alternativo que Zoho también usa
  invoice_id?: string
  status?: string
}

export async function POST(req: NextRequest) {
  let body: ZohoWebhookPayload
  try {
    body = await req.json() as ZohoWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Zoho puede enviar el invoice_id en distintos niveles del payload
  const invoiceId = body.data?.invoice?.invoice_id ?? body.invoice_id
  const status = body.data?.invoice?.status ?? body.status

  console.log('[zoho/webhook]', { event_type: body.event_type, invoiceId, status })

  if (!invoiceId) {
    return NextResponse.json({ ok: true, skipped: 'no invoice_id' })
  }

  const esPagada = status === 'paid'

  // Solo actualizamos cuando pasa a pagada o se revierte (void/draft)
  if (status !== 'paid' && status !== 'void' && status !== 'draft') {
    return NextResponse.json({ ok: true, skipped: `status ${status} no requiere acción` })
  }

  const admin = getSupabaseAdmin()
  const { data: paquete } = await admin
    .from('paquetes')
    .select('id, factura_pagada')
    .eq('factura_id', invoiceId)
    .maybeSingle()

  if (!paquete) {
    console.warn('[zoho/webhook] No se encontró paquete con factura_id:', invoiceId)
    return NextResponse.json({ ok: true, skipped: 'paquete no encontrado' })
  }

  if (paquete.factura_pagada === esPagada) {
    return NextResponse.json({ ok: true, skipped: 'ya estaba actualizado' })
  }

  const { error } = await admin
    .from('paquetes')
    .update({ factura_pagada: esPagada, updated_at: new Date().toISOString() })
    .eq('id', paquete.id)

  if (error) {
    console.error('[zoho/webhook] Error actualizando paquete:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[zoho/webhook] Paquete ${paquete.id} → factura_pagada: ${esPagada}`)
  return NextResponse.json({ ok: true, paquete_id: paquete.id, factura_pagada: esPagada })
}

// Zoho verifica el endpoint con GET antes de activar el webhook
export async function GET() {
  return NextResponse.json({ ok: true, service: 'CeladaShopper Zoho Webhook' })
}
