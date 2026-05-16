// GET /api/admin/usaco/debug
// Muestra exactamente qué devuelve USACO para las cajas despachadas.
// Solo accesible por admins. ELIMINAR o proteger antes de producción crítica.

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const USACO_URL = 'https://apiserviceusaco.uc.r.appspot.com/usaco/agencia-paqueteria/'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return null
  return admin
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const apiKey  = process.env.USACO_API_KEY  ?? ''
  const password = process.env.USACO_PASSWORD ?? ''

  // 1. Cajas despachadas con tracking
  const { data: cajas } = await admin
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, estado_usaco')
    .eq('estado', 'despachada')
    .not('tracking_usaco', 'is', null)
    .neq('tracking_usaco', '')

  if (!cajas || cajas.length === 0) {
    return NextResponse.json({ mensaje: 'No hay cajas despachadas con tracking_usaco', cajas: [] })
  }

  const trackingsEnDB = cajas.map(c => ({
    caja: c.codigo_interno,
    tracking_usaco_raw: c.tracking_usaco,
    estado_usaco_db: c.estado_usaco,
  }))

  // 2. Preparar guías normalizadas (quitando ceros)
  const norm = (g: string) => g.trim().replace(/^0+/, '') || '0'
  const guiasNormalizadas = [...new Set(cajas.map(c => norm(c.tracking_usaco as string)))]

  // 3. Llamar a USACO y guardar respuesta RAW
  let rawResponse: unknown = null
  let httpStatus: number | null = null
  let httpError: string | null = null
  let requestBody: unknown = null

  try {
    requestBody = { agency_password: '***', type: 'guias', info: guiasNormalizadas }

    const res = await fetch(USACO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ agency_password: password, type: 'guias', info: guiasNormalizadas }),
      signal: AbortSignal.timeout(20_000),
    })

    httpStatus = res.status
    const text = await res.text()

    try {
      rawResponse = JSON.parse(text)
    } catch {
      rawResponse = text  // devolver como texto si no es JSON
    }

    if (!res.ok) {
      httpError = `HTTP ${res.status}`
    }
  } catch (err) {
    httpError = err instanceof Error ? err.message : String(err)
  }

  // 4. Analizar qué campos devuelve USACO
  const analisis = Array.isArray(rawResponse)
    ? (rawResponse as Record<string, unknown>[]).slice(0, 5).map(r => ({
        campos_disponibles: Object.keys(r),
        valores:            r,
      }))
    : null

  return NextResponse.json({
    env_check: {
      USACO_API_KEY_set:  !!apiKey,
      USACO_PASSWORD_set: !!password,
      url: USACO_URL,
    },
    cajas_en_db:           trackingsEnDB,
    guias_enviadas_usaco:  guiasNormalizadas,
    request_body:          requestBody,
    usaco_http_status:     httpStatus,
    usaco_http_error:      httpError,
    usaco_raw_response:    rawResponse,
    analisis_primeros_5:   analisis,
    total_resultados:      Array.isArray(rawResponse) ? (rawResponse as unknown[]).length : null,
  })
}
