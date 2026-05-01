import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Users, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
    .select('id, nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad, activo, created_at')
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
  const filtrados = q
    ? lista.filter(c => {
        const txt = `${c.nombre_completo} ${c.email} ${c.numero_casilla} ${c.ciudad ?? ''}`.toLowerCase()
        return txt.includes(q.toLowerCase())
      })
    : lista

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

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ciudad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paquetes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Desde</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    No hay clientes con esos filtros
                  </td>
                </tr>
              ) : (
                filtrados.map(c => {
                  const stats = paquetesMap[c.id] ?? { total: 0, activos: 0 }
                  return (
                    <tr key={c.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{c.nombre_completo}</p>
                          <p className="text-xs text-orange-600 font-mono">{c.numero_casilla}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-0.5">
                          <p className="text-gray-600 text-xs truncate max-w-[180px]">{c.email}</p>
                          {(c.whatsapp ?? c.telefono) && (
                            <a
                              href={`https://wa.me/${(c.whatsapp ?? c.telefono)?.replace(/\D/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-green-600 text-xs hover:underline"
                            >
                              {c.whatsapp ?? c.telefono}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 capitalize">{c.ciudad ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/admin/paquetes?q=${encodeURIComponent(c.nombre_completo)}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <span className="font-bold text-gray-900">{stats.activos}</span>
                          <span className="text-gray-400 text-xs">/ {stats.total}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                        {new Date(c.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={c.activo ? 'border-green-200 text-green-700' : 'border-red-200 text-red-600'}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
