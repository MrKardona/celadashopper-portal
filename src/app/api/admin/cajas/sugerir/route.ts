// GET /api/admin/cajas/sugerir?max_valor=200
//
// Sugiere cómo armar cajas óptimas con los paquetes disponibles, respetando
// un valor declarado máximo por caja (default 200 USD). Aplica First-Fit
// Decreasing — minimiza el número de cajas necesarias mientras respeta el cap.
//
// Agrupa por bodega: cada bodega obtiene su propio plan.
// Solo considera paquetes sin caja, en estado recibido_usa o listo_envio,
// con valor_declarado > 0. Los demás se devuelven como "sin_valor" para que
// el admin sepa que faltan.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function verificarRolBodega() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

interface PaqueteSugerencia {
  id: string
  tracking_casilla: string | null
  descripcion: string
  valor_declarado: number
  peso_libras: number | null
  cliente_nombre: string | null
}

interface PaqueteSinValor {
  id: string
  tracking_casilla: string | null
  descripcion: string
  cliente_nombre: string | null
}

interface CajaSugerida {
  bodega: string
  paquetes: PaqueteSugerencia[]
  total_valor: number
}

// ─── First-Fit Decreasing ────────────────────────────────────────────────────
// Ordena los items por valor desc, luego para cada uno busca la primera caja
// donde quepa sin pasar el cap. Si no cabe, abre caja nueva. No es óptimo en
// teoría (NP-hard), pero a este volumen el resultado es muy bueno.
function armarCajas(
  paquetes: PaqueteSugerencia[],
  maxValor: number,
  bodega: string,
): CajaSugerida[] {
  const ordenados = [...paquetes].sort((a, b) => b.valor_declarado - a.valor_declarado)
  const cajas: CajaSugerida[] = []

  for (const p of ordenados) {
    if (p.valor_declarado > maxValor) {
      // Paquete individual excede el cap → caja propia (advertencia)
      cajas.push({ bodega, paquetes: [p], total_valor: p.valor_declarado })
      continue
    }
    let colocado = false
    for (const caja of cajas) {
      if (caja.total_valor + p.valor_declarado <= maxValor) {
        caja.paquetes.push(p)
        caja.total_valor = +(caja.total_valor + p.valor_declarado).toFixed(2)
        colocado = true
        break
      }
    }
    if (!colocado) {
      cajas.push({ bodega, paquetes: [p], total_valor: p.valor_declarado })
    }
  }
  return cajas
}

export async function GET(req: NextRequest) {
  const user = await verificarRolBodega()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const maxValorParam = req.nextUrl.searchParams.get('max_valor')
  const maxValor = maxValorParam ? Math.max(1, parseFloat(maxValorParam)) : 200

  const admin = getSupabaseAdmin()

  // Cargar paquetes elegibles: sin caja, estado recibido_usa o listo_envio
  const { data: paquetes, error } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, descripcion, valor_declarado, peso_libras, cliente_id, bodega_destino, estado')
    .in('estado', ['recibido_usa', 'listo_envio'])
    .is('caja_id', null)
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = paquetes ?? []

  // Cargar nombres de clientes
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const nombresMap: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await admin
      .from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    for (const p of perfiles ?? []) nombresMap[p.id] = p.nombre_completo
  }

  // Separar: con valor declarado > 0  vs  sin valor
  const conValor: Record<string, PaqueteSugerencia[]> = {}
  const sinValor: Record<string, PaqueteSinValor[]> = {}

  for (const p of lista) {
    const clienteNombre = p.cliente_id ? (nombresMap[p.cliente_id] ?? null) : null
    const bodega = p.bodega_destino as string
    const valor = typeof p.valor_declarado === 'number'
      ? p.valor_declarado
      : (p.valor_declarado != null ? parseFloat(String(p.valor_declarado)) : NaN)

    if (Number.isFinite(valor) && valor > 0) {
      if (!conValor[bodega]) conValor[bodega] = []
      conValor[bodega].push({
        id: p.id,
        tracking_casilla: p.tracking_casilla,
        descripcion: p.descripcion,
        valor_declarado: valor,
        peso_libras: typeof p.peso_libras === 'number' ? p.peso_libras
          : (p.peso_libras != null ? parseFloat(String(p.peso_libras)) : null),
        cliente_nombre: clienteNombre,
      })
    } else {
      if (!sinValor[bodega]) sinValor[bodega] = []
      sinValor[bodega].push({
        id: p.id,
        tracking_casilla: p.tracking_casilla,
        descripcion: p.descripcion,
        cliente_nombre: clienteNombre,
      })
    }
  }

  // Aplicar bin-packing por bodega
  const sugerencias: Record<string, { cajas: CajaSugerida[]; sin_valor: PaqueteSinValor[] }> = {}
  const bodegas = new Set([...Object.keys(conValor), ...Object.keys(sinValor)])
  for (const bodega of bodegas) {
    const items = conValor[bodega] ?? []
    sugerencias[bodega] = {
      cajas: items.length > 0 ? armarCajas(items, maxValor, bodega) : [],
      sin_valor: sinValor[bodega] ?? [],
    }
  }

  return NextResponse.json({
    ok: true,
    max_valor: maxValor,
    sugerencias,
  })
}
