// src/app/api/shopify/migrate/route.ts
// Migrates all Shopify customers to Supabase auth + perfiles table

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE!

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

interface ShopifyCustomersResponse {
  customers: ShopifyCustomer[]
}

interface MigrationStats {
  total: number
  created: number
  updated: number
  errors: number
}

/**
 * Fetches all customers from Shopify REST API with pagination via Link header.
 */
async function fetchAllShopifyCustomers(accessToken: string): Promise<ShopifyCustomer[]> {
  const all: ShopifyCustomer[] = []
  let nextUrl: string | null =
    `https://${SHOPIFY_STORE}/admin/api/2024-01/customers.json?limit=250`

  while (nextUrl) {
    const url = nextUrl
    const res: Response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Shopify customers fetch failed (${res.status}): ${body}`)
    }

    const data = (await res.json()) as ShopifyCustomersResponse
    all.push(...data.customers)

    // Parse Link header for pagination
    const linkHeader: string = res.headers.get('link') ?? ''
    const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = nextMatch ? nextMatch[1] : null
  }

  return all
}

/**
 * Extracts the first 5 digits of the Shopify customer ID string.
 */
function getCasilla(shopifyId: number): string {
  return String(shopifyId).slice(0, 5)
}

/**
 * Processes a single customer: creates or updates auth user + profile.
 */
async function processCustomer(
  customer: ShopifyCustomer,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stats: MigrationStats
): Promise<void> {
  const email = customer.email?.trim().toLowerCase()
  if (!email) {
    console.warn(`[migrate] Skipping customer ${customer.id} — no email`)
    stats.errors++
    return
  }

  const firstName = customer.first_name?.trim() ?? ''
  const lastName = customer.last_name?.trim() ?? ''
  const nombreCompleto = [firstName, lastName].filter(Boolean).join(' ') || email
  const phone = customer.phone ?? customer.default_address?.phone ?? null
  const city = customer.default_address?.city ?? null
  const casilla = getCasilla(customer.id)

  try {
    // Check if profile already exists by email
    const { data: existingProfile } = await supabase
      .from('perfiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      // Profile exists — just update the casilla
      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ numero_casilla: casilla })
        .eq('email', email)

      if (updateError) {
        console.error(`[migrate] Update error for ${email}:`, updateError.message)
        stats.errors++
      } else {
        stats.updated++
      }
      return
    }

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
      console.error(`[migrate] Auth createUser error for ${email}:`, authError.message)
      stats.errors++
      return
    }

    const userId = authData.user.id

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
      console.error(`[migrate] Profile upsert error for ${email}:`, profileError.message)
      stats.errors++
      return
    }

    stats.created++
  } catch (err) {
    console.error(
      `[migrate] Unexpected error for ${email}:`,
      err instanceof Error ? err.message : err
    )
    stats.errors++
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin()

  // Retrieve the stored Shopify access token
  const { data: configRow, error: configError } = await supabase
    .from('configuracion')
    .select('value')
    .eq('key', 'shopify_access_token')
    .maybeSingle()

  if (configError || !configRow?.value) {
    return NextResponse.json(
      { error: 'shopify_access_token not found in configuracion table' },
      { status: 500 }
    )
  }

  const accessToken = configRow.value as string

  const stats: MigrationStats = { total: 0, created: 0, updated: 0, errors: 0 }

  let customers: ShopifyCustomer[]
  try {
    customers = await fetchAllShopifyCustomers(accessToken)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch customers' },
      { status: 500 }
    )
  }

  stats.total = customers.length
  console.log(`[migrate] Processing ${stats.total} customers...`)

  for (const customer of customers) {
    await processCustomer(customer, supabase, stats)
  }

  console.log('[migrate] Completed:', stats)
  return NextResponse.json(stats)
}
