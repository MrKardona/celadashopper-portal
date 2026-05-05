import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Search } from 'lucide-react'
import ClientesTabla, { type ClienteRow } from '@/components/admin/ClientesTabla'

interface Props {
  searchParams: Promise<{ q?: string; ciudad?: string; orden?: string; periodo?: string }>
}

export default async function AdminClientesPage({ searchParams }: Props) {
  const params = await searchParams
  const { q, ciudad } = params
  const orden = params.orden ?? 'recientes' // default: últimos registrados
  const periodo = params.periodo ?? '' // '7', '30', '90' o vacío (todos)

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

  const { data: clientes } = await q1
  const lista = clientes ?? []

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

  // Filtro texto
  const filtrados: ClienteRow[] = (q
    ? lista.filter(c => {
        const txt = `${c.nombre_completo} ${c.email} ${c.numero_casilla} ${c.ciudad ?? ''}`.toLowerCase()
        return txt.includes(q.toLowerCase())
      })
    : lista) as ClienteRow[]

  const ciudades = [...new Set(lista.map(c => c.ciudad).filter(Boolean))]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 text-sm mt-1">
          {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
          {periodo && ` registrados en los últimos ${periodo} días`}
        </p>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar nombre, email, casillero..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-72"
          />
        </div>
        {ciudades.length > 0 && (
          <select
            name="ciudad"
            defaultValue={ciudad ?? ''}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Todas las ciudades</option>
            {ciudades.map(c => (
              <option key={c} value={c!}>{c}</option>
            ))}
          </select>
        )}
        <select
          name="periodo"
          defaultValue={periodo}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todos los registros</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </select>
        <select
          name="orden"
          defaultValue={orden}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="recientes">Más recientes primero</option>
          <option value="antiguos">Más antiguos primero</option>
          <option value="nombre">Alfabético (A-Z)</option>
        </select>
        <button
          type="submit"
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Filtrar
        </button>
        {(q || ciudad || periodo || orden !== 'recientes') && (
          <Link href="/admin/clientes" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla con edición inline */}
      <ClientesTabla clientes={filtrados} paquetesMap={paquetesMap} />
    </div>
  )
}
