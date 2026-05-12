// src/app/api/admin/recibir/ocr/route.ts
// POST /api/admin/recibir/ocr
//
// Recibe { fotoEmpaqueUrl, fotoContenidoUrl } (URLs públicas ya subidas via /api/admin/foto).
// Llama a Claude Vision en paralelo para extraer datos de la etiqueta y describir
// el contenido. Luego intenta hacer match con un cliente existente y/o un paquete
// reportado:
//   1) tracking_origen → busca paquete reportado con ese tracking
//   2) numero_casilla   → busca cliente por casilla y trae sus paquetes reportados
//   3) nombre fuzzy     → último recurso si no hay tracking ni casilla
//
// Devuelve los datos extraídos + sugerencias de match. La asignación final la
// confirma el agente desde la UI (el endpoint NO escribe en paquetes).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { analizarPaquete, type EtiquetaOCR, type ContenidoOCR } from '@/lib/ocr/paquete'

// Claude Vision + 2 fotos en paralelo puede tardar 10-20s
// Sin esto Vercel corta a los 10s y devuelve body vacío → "Unexpected end of JSON"
export const maxDuration = 60

function getSupabaseAdmin(): SupabaseClient {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Permite admin y agente_usa (ambos reciben paquetes en bodega USA)
async function verificarRolBodega() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!perfil || !['admin', 'agente_usa'].includes(perfil.rol)) return null
  return user
}

interface ClienteSugerido {
  id: string
  nombre_completo: string
  email: string
  numero_casilla: string | null
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
}

interface PaqueteSugerido {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string
  cliente: ClienteSugerido | null
}

interface MatchResult {
  tipo: 'tracking' | 'casillero' | 'nombre' | null
  paquete: PaqueteSugerido | null
  cliente: ClienteSugerido | null
  candidatos_paquetes: PaqueteSugerido[]
}

// Normaliza un string de casilla: "CS 0042", "cs-0042", "0042" → "CS-0042"
function normalizarCasilla(raw: string | null | undefined): string | null {
  if (!raw) return null
  const limpio = raw.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const num = limpio.replace(/^CS/, '')
  if (!/^\d+$/.test(num)) return null
  return `CS-${num.padStart(4, '0')}`
}

// Normaliza un tracking de courier eliminando espacios. Mantiene letras,
// números y guiones (algunos couriers los usan, ej: 1Z-9999...). El cliente
// reporta el tracking sin espacios al pegarlo del email del courier, así
// que normalizamos para que el match exacto en BD funcione.
function normalizarTracking(raw: string | null | undefined): string | null {
  if (!raw) return null
  const limpio = raw.toString().replace(/\s+/g, '').trim()
  return limpio.length > 0 ? limpio : null
}

async function buscarMatch(
  admin: SupabaseClient,
  etiqueta: EtiquetaOCR,
): Promise<MatchResult> {
  const result: MatchResult = {
    tipo: null,
    paquete: null,
    cliente: null,
    candidatos_paquetes: [],
  }

  // 1) Match por tracking_origen
  if (etiqueta.tracking_origen) {
    const { data: paquetes } = await admin
      .from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, cliente_id')
      .eq('tracking_origen', etiqueta.tracking_origen)
      .eq('estado', 'reportado')
      .limit(5)

    if (paquetes && paquetes.length > 0) {
      const ids = paquetes.map(p => p.cliente_id).filter(Boolean) as string[]
      const { data: perfiles } = ids.length > 0
        ? await admin.from('perfiles').select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad').in('id', ids)
        : { data: [] }
      const mapaPerfiles = new Map((perfiles ?? []).map(p => [p.id, p]))
      const enriched: PaqueteSugerido[] = paquetes.map(p => ({
        id: p.id,
        tracking_casilla: p.tracking_casilla,
        tracking_origen: p.tracking_origen,
        descripcion: p.descripcion,
        cliente: p.cliente_id ? (mapaPerfiles.get(p.cliente_id) ?? null) : null,
      }))
      result.tipo = 'tracking'
      result.paquete = enriched[0]
      result.cliente = enriched[0].cliente
      result.candidatos_paquetes = enriched
      return result
    }
  }

  // 2) Match por casillero
  const casilla = normalizarCasilla(etiqueta.numero_casilla)
  if (casilla) {
    const { data: cliente } = await admin
      .from('perfiles')
      .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
      .eq('numero_casilla', casilla)
      .eq('activo', true)
      .maybeSingle()

    if (cliente) {
      const { data: paquetes } = await admin
        .from('paquetes')
        .select('id, tracking_casilla, tracking_origen, descripcion')
        .eq('cliente_id', cliente.id)
        .eq('estado', 'reportado')
        .order('created_at', { ascending: false })
        .limit(10)

      result.tipo = 'casillero'
      result.cliente = cliente
      result.candidatos_paquetes = (paquetes ?? []).map(p => ({
        id: p.id,
        tracking_casilla: p.tracking_casilla,
        tracking_origen: p.tracking_origen,
        descripcion: p.descripcion,
        cliente,
      }))
      result.paquete = result.candidatos_paquetes[0] ?? null
      return result
    }
  }

  // 3) Match fuzzy por nombre (último recurso)
  if (etiqueta.nombre_destinatario) {
    const partes = etiqueta.nombre_destinatario.trim().split(/\s+/).filter(p => p.length >= 3)
    if (partes.length > 0) {
      const ilike = `%${partes[0]}%`
      const { data: clientes } = await admin
        .from('perfiles')
        .select('id, nombre_completo, email, numero_casilla, whatsapp, telefono, ciudad')
        .ilike('nombre_completo', ilike)
        .eq('activo', true)
        .eq('rol', 'cliente')
        .limit(5)

      if (clientes && clientes.length === 1) {
        result.tipo = 'nombre'
        result.cliente = clientes[0]
      }
    }
  }

  return result
}

interface OcrBody {
  fotoEmpaqueUrl?: unknown
  fotoContenidoUrl?: unknown
}

export async function POST(req: NextRequest) {
  const user = await verificarRolBodega()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: OcrBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const fotoEmpaqueUrl = typeof body.fotoEmpaqueUrl === 'string' ? body.fotoEmpaqueUrl : null
  const fotoContenidoUrl = typeof body.fotoContenidoUrl === 'string' ? body.fotoContenidoUrl : null

  if (!fotoEmpaqueUrl || !fotoContenidoUrl) {
    return NextResponse.json(
      { error: 'Se requieren fotoEmpaqueUrl y fotoContenidoUrl' },
      { status: 400 },
    )
  }

  let etiqueta: EtiquetaOCR
  let contenido: ContenidoOCR
  try {
    const res = await analizarPaquete(fotoEmpaqueUrl, fotoContenidoUrl)
    etiqueta = res.etiqueta
    contenido = res.contenido
  } catch (err) {
    console.error('[ocr] análisis falló:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error analizando fotos' },
      { status: 500 },
    )
  }

  // Normalizar tracking eliminando espacios. Los clientes reportan el tracking
  // sin espacios (lo pegan del email del courier), así que el match en BD
  // solo funciona si lo normalizamos al extraerlo de la etiqueta también.
  const trackingNormalizado = normalizarTracking(etiqueta.tracking_origen)
  const etiquetaNormalizada: EtiquetaOCR = {
    ...etiqueta,
    tracking_origen: trackingNormalizado,
    numero_casilla: normalizarCasilla(etiqueta.numero_casilla) ?? etiqueta.numero_casilla,
  }

  const admin = getSupabaseAdmin()
  const match = await buscarMatch(admin, etiquetaNormalizada)

  return NextResponse.json({
    ok: true,
    etiqueta: etiquetaNormalizada,
    contenido,
    match,
  })
}
