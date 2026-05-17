export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { sanitizeSearchTerm } from '@/lib/search'
import { Search } from 'lucide-react'
import ClientesTabla, { type ClienteRow } from '@/components/admin/ClientesTabla'
import NuevoClienteModal from '@/components/admin/NuevoClienteModal'
import LimitSelector from '@/components/ui/LimitSelector'

interface Props {
  searchParams: Promise<{ q?: string; ciudad?: string; orden?: string; periodo?: string; limite?: string }>
}

export default async function AdminClientesPage({ searchParams }: Props) {
  const params = await searchParams
  const { q, ciudad } = params
  const orden = params.orden ?? 'recientes'
  const periodo = params.periodo ?? ''
  const limite = [10, 50, 100].includes(Number(params.limite)) ? Number(params.limite) : 50

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  // Orden: más recientes primero por defecto
  let q1 = supabase
    .from('perfiles')
    .select('id, nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad, direccion, barrio, referencia, activo, created_at')
    .eq('rol', 'cliente')

  if (orden === 'antiguos') {
    q1 = q1.order('created_at', { ascending: true })
  } else if (orden === 'nombre') {
    q1 = q1.order('nombre_completo', { ascending: true })
  } else {
    // 'recientes' (default)
    q1 = q1.order('created_at', { ascending: false })
  }

  if (ciudad) q1 = q1.eq('ciudad', ciudad)

  // Filtro por periodo (días desde hoy)
  if (periodo === '7' || periodo === '30' || periodo === '90') {
    const dias = parseInt(periodo, 10)
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    q1 = q1.gte('created_at', desde)
  }

  // Búsqueda en la BD (no filtrado local) — busca en todos los clientes
  if (q) {
    const sanitized = sanitizeSearchTerm(q)
    if (sanitized.length > 0) {
      const term = `%${sanitized}%`
      q1 = q1.or(
        `nombre_completo.ilike.${term},email.ilike.${term},numero_casilla.ilike.${term},whatsapp.ilike.${term},telefono.ilike.${term}`
      )
    }
  }

  const LIMIT = q ? 200 : limite
  const { data: clientes, error: clientesError } = await q1.limit(LIMIT)
  if (clientesError) console.error('[admin/clientes]', clientesError.message)
  const lista = clientes ?? []
  const resultadosTruncados = lista.length === LIMIT

  // Query 2: conteo de paquetes por cliente
  const clienteIds = lista.map(c => c.id)
  let paquetesMap: Record<string, { total: number; activos: number }> = {}

  if (clienteIds.length > 0) {
    const { data: paquetes } = await supabase
      .from('paquetes')
      .select('cliente_id, estado')
      .in('cliente_id', clienteIds)

    if (paquetes) {
      for (const p of paquetes) {
        if (!p.cliente_id) continue
        if (!paquetesMap[p.cliente_id]) paquetesMap[p.cliente_id] = { total: 0, activos: 0 }
        paquetesMap[p.cliente_id].total++
        if (!['entregado', 'devuelto'].includes(p.estado)) {
          paquetesMap[p.cliente_id].activos++
        }
      }
    }
  }

  const filtrados: ClienteRow[] = lista as ClienteRow[]
  const ciudades = [...new Set(lista.map(c => c.ciudad).filter(Boolean))]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
            {periodo && ` · últimos ${periodo} días`}
            {resultadosTruncados && <span className="text-amber-400"> · mostrando primeros {LIMIT} — refina la búsqueda</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LimitSelector actual={limite} />
          <NuevoClienteModal />
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar nombre, email, casillero..."
            className="glass-input pl-9 pr-4 py-2 text-sm rounded-xl w-72"
          />
        </div>
        {ciudades.length > 0 && (
          <select name="ciudad" defaultValue={ciudad ?? ''} className="glass-input text-sm px-3 py-2 rounded-xl">
            <option value="">Todas las ciudades</option>
            {ciudades.map(c => (
              <option key={c} value={c!}>{c}</option>
            ))}
          </select>
        )}
        <select name="periodo" defaultValue={periodo} className="glass-input text-sm px-3 py-2 rounded-xl">
          <option value="">Todos los registros</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </select>
        <select name="orden" defaultValue={orden} className="glass-input text-sm px-3 py-2 rounded-xl">
          <option value="recientes">Más recientes primero</option>
          <option value="antiguos">Más antiguos primero</option>
          <option value="nombre">Alfabético (A-Z)</option>
        </select>
        <button type="submit" className="btn-gold px-4 py-2 rounded-xl text-sm font-semibold">
          Filtrar
        </button>
        {(q || ciudad || periodo || orden !== 'recientes') && (
          <Link href="/admin/clientes" className="px-4 py-2 text-sm rounded-xl font-medium transition-all" style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla con edición inline */}
      <ClientesTabla clientes={filtrados} paquetesMap={paquetesMap} />
    </div>
  )
}
