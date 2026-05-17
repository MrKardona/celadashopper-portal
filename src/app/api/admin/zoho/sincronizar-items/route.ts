// POST /api/admin/zoho/sincronizar-items
// Crea o actualiza un artículo en Zoho Inventory por cada categoría de tarifa.
// Guarda el zoho_item_id en categorias_tarifas para usarlo en facturas.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

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

// Nombres de artículo para cada categoría
const NOMBRE_ITEM: Record<string, string> = {
  ropa_accesorios: 'Envío Ropa y Accesorios',
  suplementos:     'Envío Suplementos',
  cosmeticos:      'Envío Cosméticos',
  perfumeria:      'Envío Perfumería',
  calzado:         'Envío Calzado',
  juguetes:        'Envío Juguetes',
  libros:          'Envío Libros',
  electrodomestico:'Envío Electrodomésticos',
  computador:      'Envío Computadores (libra comercial)',
  ipad_tablet:     'Envío iPad y Tablets (libra comercial)',
  celular:         'Envío Celulares (Barranquilla)',
  otro:            'Envío Otros Artículos',
}

export async function POST() {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = process.env.ZOHO_ORG_ID
  if (!orgId || !process.env.ZOHO_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Zoho no configurado' }, { status: 503 })
  }

  const admin = getSupabaseAdmin()
  const { data: tarifas } = await admin
    .from('categorias_tarifas')
    .select('id, categoria, nombre_display, tarifa_por_libra, precio_fijo, tarifa_tipo, costo_envio_libra, costo_envio_fijo, zoho_item_id')
    .eq('activo', true)

  if (!tarifas?.length) return NextResponse.json({ error: 'Sin tarifas' }, { status: 404 })

  const token = await getAccessToken()
  const resultados: { categoria: string; item_id: string; accion: string }[] = []

  for (const t of tarifas) {
    const nombre = NOMBRE_ITEM[t.categoria] ?? `Envío ${t.nombre_display}`
    const purchaseRate = Number(t.costo_envio_libra ?? t.costo_envio_fijo ?? 0)

    const itemPayload = {
      name: nombre,
      item_type: 'service',
      product_type: 'service',
      description: t.nombre_display,
      rate: 0,          // Se sobreescribe en cada factura según peso
      purchase_rate: purchaseRate,
      unit: 'pcs',
    }

    if (t.zoho_item_id) {
      // Actualizar item existente
      const res = await fetch(
        `https://www.zohoapis.com/inventory/v1/items/${t.zoho_item_id}?organization_id=${orgId}`,
        {
          method: 'PUT',
          headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        }
      )
      const data = await res.json() as { item?: { item_id: string }; message?: string }
      if (data.item?.item_id) {
        resultados.push({ categoria: t.categoria, item_id: data.item.item_id, accion: 'actualizado' })
      }
    } else {
      // Crear nuevo item
      const res = await fetch(
        `https://www.zohoapis.com/inventory/v1/items?organization_id=${orgId}`,
        {
          method: 'POST',
          headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        }
      )
      const data = await res.json() as { item?: { item_id: string }; message?: string }
      if (data.item?.item_id) {
        await admin
          .from('categorias_tarifas')
          .update({ zoho_item_id: data.item.item_id })
          .eq('id', t.id)
        resultados.push({ categoria: t.categoria, item_id: data.item.item_id, accion: 'creado' })
      } else {
        resultados.push({ categoria: t.categoria, item_id: '', accion: `error: ${data.message ?? 'desconocido'}` })
      }
    }
  }

  return NextResponse.json({ ok: true, resultados })
}
