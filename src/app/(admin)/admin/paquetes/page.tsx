import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS } from '@/types'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
import { Package, Search } from 'lucide-react'

const ESTADOS = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente',
  'entregado', 'retenido', 'devuelto',
]

const BODEGAS = ['medellin', 'bogota', 'barranquilla']
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

interface Props {
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q } = params
  const supabaseAdmin = getSupabaseAdmin()

  let query = supabaseAdmin
    .from('paquetes')
    .select(`
      id, tracking_casilla, descripcion, tienda, categoria,
      estado, bodega_destino, peso_facturable, peso_libras,
      costo_servicio, factura_pagada, created_at, updated_at,
      perfiles!left(nombre_completo, numero_casilla)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) query = query.eq('estado', estado)
  if (bodega) query = query.eq('bodega_destino', bodega)

  const { data: paquetes } = await query
  const lista = paquetes ?? []

  // Filtro de búsqueda por texto (client-side sobre los resultados)
  const filtrados = q
    ? lista.filter(p => {
        const perfil = p.perfiles as unknown as { nombre_completo: string; numero_casilla: string } | null
        const txt =`${p.tracking_casilla} ${p.descripcion} ${p.tienda} ${perfil?.nombre_completo} ${perfil?.numero_casilla}`.toLowerCase()
        return txt.includes(q.toLowerCase())
      })
    : lista

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paquetes</h1>
          <p className="text-gray-500 text-sm mt-1">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar tracking, cliente, producto..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-72"
          />
        </div>
        <select
          name="estado"
          defaultValue={estado ?? ''}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => (
            <option key={e} value={e}>{ESTADO_LABELS[e as keyof typeof ESTADO_LABELS] ?? e}</option>
          ))}
        </select>
        <select
          name="bodega"
          defaultValue={bodega ?? ''}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Todas las bodegas</option>
          {BODEGAS.map(b => (
            <option key={b} value={b}>{BODEGA_LABELS[b]}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Filtrar
        </button>
        {(estado || bodega || q) && (
          <Link
            href="/admin/paquetes"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tracking</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Bodega</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Peso / Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    No hay paquetes con esos filtros
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const perfil = p.perfiles as unknown as { nombre_completo: string; numero_casilla: string } | null
                  const peso = p.peso_facturable ?? p.peso_libras
                  return (
                    <tr key={p.id} className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${!perfil ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          <span className="font-mono text-xs text-orange-700 font-semibold">{p.tracking_casilla ?? '—'}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          {perfil ? (
                            <>
                              <p className="font-medium text-gray-900 truncate max-w-[140px]">{perfil.nombre_completo}</p>
                              <p className="text-xs text-gray-400">{perfil.numero_casilla}</p>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              ⏳ Sin asignar
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          <p className="text-gray-700 truncate max-w-[180px]">{p.descripcion}</p>
                          <p className="text-xs text-gray-400">{p.tienda}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                        {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS] ?? p.categoria}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLORES[p.estado as keyof typeof ESTADO_COLORES] ?? 'bg-gray-100 text-gray-700'}`}>
                          {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 capitalize">
                        {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {peso ? (
                          <div>
                            <p className="text-gray-700 font-medium">{peso} lb</p>
                            {p.costo_servicio ? (
                              <p className={`text-xs font-semibold ${p.factura_pagada ? 'text-green-600' : 'text-red-500'}`}>
                                ${p.costo_servicio} {p.factura_pagada ? '✓' : 'pendiente'}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">Sin pesar</span>
                        )}
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
