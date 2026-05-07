// POST /api/admin/zoho/crear-factura
// Crea una factura en Zoho Inventory para un paquete y guarda el factura_id.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

// ─── Obtener Access Token desde Refresh Token ─────────────────────────────────
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

// ─── Buscar o crear contacto en Zoho Inventory ───────────────────────────────
async function obtenerContactoZoho(
  token: string,
  orgId: string,
  nombre: string,
  email: string,
): Promise<string> {
  // 1. Buscar por email
  const buscarRes = await fetch(
    `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${orgId}&email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  )
  const buscarData = await buscarRes.json() as { contacts?: { contact_id: string }[] }
  if (buscarData.contacts && buscarData.contacts.length > 0) {
    return buscarData.contacts[0].contact_id
  }

  // 2. No existe → crear
  const crearRes = await fetch(
    `https://www.zohoapis.com/inventory/v1/contacts?organization_id=${orgId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_name: nombre,
        contact_type: 'customer',
        email,
      }),
    }
  )
  const crearData = await crearRes.json() as { contact?: { contact_id: string }; message?: string }
  if (!crearData.contact?.contact_id) {
    throw new Error(`No se pudo crear contacto en Zoho: ${crearData.message ?? JSON.stringify(crearData)}`)
  }
  return crearData.contact.contact_id
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { paquete_id } = await req.json() as { paquete_id: string }
  if (!paquete_id) return NextResponse.json({ error: 'Falta paquete_id' }, { status: 400 })

  // Verificar credenciales configuradas
  const orgId = process.env.ZOHO_ORG_ID
  if (!orgId || !process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'Zoho no configurado. Agrega ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN y ZOHO_ORG_ID a las variables de entorno.',
    }, { status: 503 })
  }

  const admin = getSupabaseAdmin()

  // Cargar paquete + tarifa de su categoría (para zoho_item_id)
  const [{ data: paquete }, ] = await Promise.all([
    admin.from('paquetes').select('*').eq('id', paquete_id).single(),
  ])
  if (!paquete) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })

  const { data: tarifa } = await admin
    .from('categorias_tarifas')
    .select('zoho_item_id, nombre_display')
    .eq('categoria', paquete.categoria)
    .single()

  if (paquete.factura_id) {
    return NextResponse.json({ error: 'Este paquete ya tiene una factura creada', factura_id: paquete.factura_id }, { status: 409 })
  }

  if (!paquete.costo_servicio || paquete.costo_servicio <= 0) {
    return NextResponse.json({ error: 'El paquete no tiene costo de servicio calculado. Calcula el costo primero.' }, { status: 400 })
  }

  // Cargar perfil del cliente
  let clienteNombre = 'Cliente CeladaShopper'
  let clienteEmail = ''
  if (paquete.cliente_id) {
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre_completo, email')
      .eq('id', paquete.cliente_id)
      .single()
    if (perfil) {
      clienteNombre = perfil.nombre_completo ?? clienteNombre
      clienteEmail = perfil.email ?? ''
    }
  }

  try {
    const token = await getAccessToken()

    // Obtener o crear contacto en Zoho
    let contactId: string | null = null
    if (clienteEmail) {
      contactId = await obtenerContactoZoho(token, orgId, clienteNombre, clienteEmail)
    }

    // Descripción de la línea de la factura
    const descripcionItem = [
      paquete.descripcion,
      paquete.tracking_casilla ? `(${paquete.tracking_casilla})` : '',
    ].filter(Boolean).join(' ')

    // Construir factura
    const facturaPayload: Record<string, unknown> = {
      date: new Date().toISOString().split('T')[0],
      ...(contactId ? { customer_id: contactId } : { customer_name: clienteNombre }),
      reference_number: paquete.tracking_casilla ?? paquete_id,
      notes: `Envío CeladaShopper · Tracking: ${paquete.tracking_casilla ?? '—'} · Paquete: ${paquete.descripcion}`,
      line_items: [
        {
          ...(tarifa?.zoho_item_id ? { item_id: tarifa.zoho_item_id } : { name: tarifa?.nombre_display ?? 'Servicio de envío' }),
          description: descripcionItem,
          quantity: 1,
          rate: Number(paquete.costo_servicio),
          unit: 'pcs',
        },
      ],
    }

    const facturaRes = await fetch(
      `https://www.zohoapis.com/inventory/v1/invoices?organization_id=${orgId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facturaPayload),
      }
    )

    const facturaData = await facturaRes.json() as {
      invoice?: { invoice_id: string; invoice_number: string; invoice_url?: string }
      message?: string
      code?: number
    }

    if (!facturaData.invoice?.invoice_id) {
      console.error('[Zoho] Respuesta inesperada:', JSON.stringify(facturaData))
      throw new Error(facturaData.message ?? `Zoho respondió código ${facturaData.code ?? facturaRes.status}`)
    }

    const zohoInvoiceId = facturaData.invoice.invoice_id
    const zohoInvoiceNum = facturaData.invoice.invoice_number

    // Guardar factura_id en el paquete
    await admin
      .from('paquetes')
      .update({
        factura_id: zohoInvoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paquete_id)

    return NextResponse.json({
      ok: true,
      invoice_id: zohoInvoiceId,
      invoice_number: zohoInvoiceNum,
      zoho_url: `https://inventory.zoho.com/app#/invoices/${zohoInvoiceId}`,
    })

  } catch (err) {
    console.error('[Zoho crear-factura]', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Error al crear factura en Zoho',
    }, { status: 500 })
  }
}
