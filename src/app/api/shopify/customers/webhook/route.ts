// src/app/api/shopify/customers/webhook/route.ts
// Webhook handler for new Shopify customer registrations

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>
import { createHmac } from 'crypto'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin(): AdminClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

interface ShopifyWebhookAddress {
  phone?: string | null
  city?: string | null
}

interface ShopifyWebhookCustomer {
  id: number
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  default_address?: ShopifyWebhookAddress | null
}

/**
 * Verifies the HMAC-SHA256 signature sent by Shopify.
 */
function verifyWebhookSignature(rawBody: string, hmacHeader: string): boolean {
  const computed = createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64')
  return computed === hmacHeader
}

/**
 * Extracts the first 5 digits of the Shopify customer ID string.
 */
function getCasilla(shopifyId: number): string {
  return String(shopifyId).slice(0, 5)
}

export async function POST(request: NextRequest) {
  // Read raw body for HMAC verification
  const rawBody = await request.text()
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifyWebhookSignature(rawBody, hmacHeader)) {
    console.warn('[webhook] Invalid HMAC signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let customer: ShopifyWebhookCustomer
  try {
    customer = JSON.parse(rawBody) as ShopifyWebhookCustomer
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = customer.email?.trim().toLowerCase()
  if (!email) {
    console.warn('[webhook] Customer has no email — skipping')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const firstName = customer.first_name?.trim() ?? ''
  const lastName = customer.last_name?.trim() ?? ''
  const nombreCompleto = [firstName, lastName].filter(Boolean).join(' ') || email
  const phone = customer.phone ?? customer.default_address?.phone ?? null
  const city = customer.default_address?.city ?? null
  const casilla = getCasilla(customer.id)

  const supabase = getSupabaseAdmin()

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('perfiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle()

  let userId: string | null = null

  if (existingProfile) {
    // Update casilla only
    await supabase.from('perfiles').update({ numero_casilla: casilla }).eq('email', email)
    userId = existingProfile.id as string
  } else {
    // Create new auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombreCompleto,
        numero_casilla: casilla,
      },
    })

    if (authError) {
      console.error('[webhook] Auth createUser error:', authError.message)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    userId = authData.user.id

    // Upsert profile
    const { error: profileError } = await supabase.from('perfiles').upsert(
      {
        id: userId,
        nombre_completo: nombreCompleto,
        email,
        whatsapp: phone,
        telefono: phone,
        numero_casilla: casilla,
        ciudad: city,
        rol: 'cliente',
        activo: true,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error('[webhook] Profile upsert error:', profileError.message)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
  }

  // Send WhatsApp welcome message via Kommo
  if (phone) {
    const mensaje = `¡Hola ${firstName || 'cliente'}! 👋 Tu casillero en CeladaShopper es *${casilla}*. Accede a tu portal en: https://portal.celadashopper.com`

    try {
      const result = await sendProactiveWhatsApp(phone, mensaje)
      console.log(`[webhook] WhatsApp result for ${email}:`, result)
    } catch (err) {
      // Non-fatal — log and continue
      console.error('[webhook] WhatsApp send error:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ ok: true, userId, casilla })
}
