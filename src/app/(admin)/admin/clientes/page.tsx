import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Search } from 'lucide-react'
import ClientesTabla, { type ClienteRow } from '@/components/admin/ClientesTabla'

interface Props {
  searchParams: Promise<{ q?: string; ciudad?: string }>
}

export default async function AdminClientesPage({ searchParams }: Props) {
  const params = await searchParams
  const { q, ciudad } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  // Query 1: todos los clientes
  let q1 = supabase
    .from('perfiles')
    .select('id, nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad, direccion, barrio, referencia, activo, created_at')
    .eq('rol', 'cliente')
    .order('nombre_completo')

  if (ciudad) q1 = q1.eq('ciudad', ciudad)

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
        <p className="text-gray-500 text-sm mt-1">{filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar nombre, email, casilla..."
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
        <button
          type="submit"
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Filtrar
        </button>
        {(q || ciudad) && (
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
