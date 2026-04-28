// src/app/api/shopify/callback/route.ts
// Shopify OAuth callback — exchanges code for access token and stores it

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, 'public', any>

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!
const SHOPIFY_STORE = process.env.SHOPIFY_STORE!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin(): AdminClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return new NextResponse('<h1>Error: Missing code parameter</h1>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Exchange code for access token
  let accessToken: string
  try {
    const tokenRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: SHOPIFY_CLIENT_ID,
          client_secret: SHOPIFY_CLIENT_SECRET,
          code,
        }),
      }
    )

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text()
      console.error('[Shopify OAuth] Token exchange failed:', errorBody)
      return new NextResponse(
        `<h1>Error: Token exchange failed</h1><pre>${errorBody}</pre>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      )
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) {
      throw new Error('No access_token in response')
    }
    accessToken = tokenData.access_token
  } catch (err) {
    console.error('[Shopify OAuth] Unexpected error:', err)
    return new NextResponse(
      `<h1>Error: ${err instanceof Error ? err.message : 'Unknown error'}</h1>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Store token in Supabase configuracion table
  const supabase = getSupabaseAdmin()
  const { error: upsertError } = await supabase
    .from('configuracion')
    .upsert(
      { key: 'shopify_access_token', value: accessToken, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (upsertError) {
    console.error('[Shopify OAuth] Supabase upsert error:', upsertError)
    return new NextResponse(
      `<h1>Error saving token: ${upsertError.message}</h1>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  console.log('[Shopify OAuth] Access token stored successfully')

  // Trigger customer migration in background (fire and forget)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.celadashopper.com'
  fetch(`${baseUrl}/api/shopify/migrate`).catch((err) =>
    console.error('[Shopify OAuth] Failed to trigger migration:', err)
  )

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Shopify Conectado</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 2rem 3rem; box-shadow: 0 2px 12px rgba(0,0,0,.08); text-align: center; max-width: 480px; }
    h1 { color: #16a34a; }
    p { color: #374151; }
    small { color: #6b7280; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Shopify conectado</h1>
    <p>El token de acceso fue guardado correctamente en Supabase.</p>
    <p>La migración de clientes ha sido iniciada en segundo plano.</p>
    <small>State: ${state ?? '—'}</small>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
