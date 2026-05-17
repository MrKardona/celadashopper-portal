// scripts/migrate-shopify.mjs
// Ejecutar desde la raíz del proyecto: node scripts/migrate-shopify.mjs
// Lee credenciales desde .env.local automáticamente
// Migra todos los clientes de Shopify a Supabase sin límite de tiempo

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Leer .env.local
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const SHOPIFY_STORE = env.SHOPIFY_STORE

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SHOPIFY_STORE) {
  console.error('❌ Faltan variables en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOPIFY_STORE')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getShopifyToken() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('value')
    .eq('key', 'shopify_access_token')
    .maybeSingle()

  if (error || !data?.value) {
    throw new Error('shopify_access_token no encontrado en Supabase. Primero autoriza Shopify.')
  }
  return data.value
}

async function fetchAllCustomers(token) {
  const all = []
  let nextUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/customers.json?limit=250`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { 'X-Shopify-Access-Token': token }
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Shopify error ${res.status}: ${body}`)
    }
    const data = await res.json()
    all.push(...data.customers)
    console.log(`  Cargados: ${all.length} clientes...`)

    const link = res.headers.get('link') ?? ''
    const m = link.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = m ? m[1] : null
  }
  return all
}

async function processCustomer(customer, stats) {
  const email = customer.email?.trim().toLowerCase()
  if (!email) {
    console.warn(`  ⚠ Saltando ${customer.id} — sin email`)
    stats.errors++
    return
  }

  const firstName = customer.first_name?.trim() ?? ''
  const lastName = customer.last_name?.trim() ?? ''
  const nombreCompleto = [firstName, lastName].filter(Boolean).join(' ') || email
  const phone = customer.phone ?? customer.default_address?.phone ?? null
  const city = customer.default_address?.city ?? null
  const casilla = String(customer.id).slice(0, 5)

  try {
    const { data: existing } = await supabase
      .from('perfiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      await supabase.from('perfiles').update({ numero_casilla: casilla }).eq('email', email)
      stats.updated++
      return
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nombre_completo: nombreCompleto, numero_casilla: casilla },
    })

    if (authError) {
      if (authError.message.includes('already')) {
        const { data: users } = await supabase.auth.admin.listUsers()
        const existingUser = users?.users?.find(u => u.email === email)
        if (existingUser) {
          await supabase.from('perfiles').upsert({
            id: existingUser.id,
            nombre_completo: nombreCompleto,
            email,
            whatsapp: phone,
            telefono: phone,
            numero_casilla: casilla,
            ciudad: city,
            rol: 'cliente',
            activo: true,
          }, { onConflict: 'id' })
          stats.updated++
          return
        }
      }
      console.error(`  ✗ Auth error ${email}: ${authError.message}`)
      stats.errors++
      return
    }

    await supabase.from('perfiles').upsert({
      id: authData.user.id,
      nombre_completo: nombreCompleto,
      email,
      whatsapp: phone,
      telefono: phone,
      numero_casilla: casilla,
      ciudad: city,
      rol: 'cliente',
      activo: true,
    }, { onConflict: 'id' })

    stats.created++
  } catch (err) {
    console.error(`  ✗ Error ${email}: ${err.message}`)
    stats.errors++
  }
}

async function main() {
  console.log('🚀 Iniciando migración Shopify → Supabase\n')

  const token = await getShopifyToken()
  console.log('✅ Token de Shopify obtenido\n')

  console.log('📦 Cargando clientes de Shopify...')
  const customers = await fetchAllCustomers(token)
  console.log(`\n✅ Total clientes: ${customers.length}\n`)

  const stats = { total: customers.length, created: 0, updated: 0, errors: 0 }

  console.log('⚙ Procesando...')
  let i = 0
  for (const c of customers) {
    await processCustomer(c, stats)
    i++
    if (i % 50 === 0) {
      console.log(`  Progreso: ${i}/${customers.length} | creados: ${stats.created} | actualizados: ${stats.updated} | errores: ${stats.errors}`)
    }
  }

  console.log('\n✅ MIGRACIÓN COMPLETA:')
  console.log(`  Total:      ${stats.total}`)
  console.log(`  Creados:    ${stats.created}`)
  console.log(`  Actualizados: ${stats.updated}`)
  console.log(`  Errores:    ${stats.errors}`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
