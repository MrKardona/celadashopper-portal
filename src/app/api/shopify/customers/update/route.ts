// POST /api/shopify/customers/update
// Webhook handler for Shopify customers/update events.
// Syncs: nombre_completo, whatsapp/telefono, ciudad.
// Email and numero_casilla are NOT overwritten (set at creation).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ShopifyAddress {
  phone?: string | null
  city?: string | null
}

interface ShopifyCustomer {
  id: number
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  default_address?: ShopifyAddress | null
}

function verifySignature(rawBody: string, hmacHeader: string): boolean {
  const computed = createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64')
  return computed === hmacHeader
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifySignature(rawBody, hmacHeader)) {
    console.warn('[customers/update] Invalid HMAC signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let customer: ShopifyCustomer
  try {
    customer = JSON.parse(rawBody) as ShopifyCustomer
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = customer.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const firstName = customer.first_name?.trim() ?? ''
  const lastName = customer.last_name?.trim() ?? ''
  const nombreCompleto = [firstName, lastName].filter(Boolean).join(' ') || null
  const phone = customer.phone ?? customer.default_address?.phone ?? null
  const city = customer.default_address?.city ?? null

  const supabase = getSupabaseAdmin()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!perfil) {
    // Profile doesn't exist yet — nothing to update
    console.info(`[customers/update] No profile for ${email}, skipping`)
    return NextResponse.json({ ok: true, skipped: true })
  }

  const updates: Record<string, string | null> = {}
  if (nombreCompleto) updates.nombre_completo = nombreCompleto
  if (phone)          updates.whatsapp = phone
  if (phone)          updates.telefono = phone
  if (city)           updates.ciudad = city

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase
    .from('perfiles')
    .update(updates)
    .eq('id', perfil.id)

  if (error) {
    console.error('[customers/update] Update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.info(`[customers/update] Updated profile for ${email}:`, updates)
  return NextResponse.json({ ok: true, updated: updates })
}
