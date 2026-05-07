import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Package, Search, Camera } from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS } from '@/types'

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
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string; asignacion?: string; consolidacion?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q, asignacion, consolidacion } = params

  // Usamos service role con la opción db.schema para evitar problemas de RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  // Query 1: paquetes (sin join — service role directo)
  let q1 = supabase
    .from('paquetes')
    .select('id, tracking_casilla, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_facturable, peso_libras, costo_servicio, valor_declarado, factura_pagada, requiere_consolidacion, notas_consolidacion, nombre_etiqueta, fecha_recepcion_usa, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado) q1 = q1.eq('estado', estado)
  if (bodega) q1 = q1.eq('bodega_destino', bodega)
  // Filtro por asignación de cliente
  if (asignacion === 'sin_asignar') q1 = q1.is('cliente_id', null)
  else if (asignacion === 'asignados') q1 = q1.not('cliente_id', 'is', null)
  if (consolidacion === 'requiere') q1 = q1.eq('requiere_consolidacion', true)
  else if (consolidacion === 'despachable') q1 = q1.eq('requiere_consolidacion', false)

  const { data: paquetes, error: errPaq } = await q1
  const lista = paquetes ?? []

  // Queries en paralelo: perfiles + primera foto de cada paquete
  const paqueteIds = lista.map(p => p.id)
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))]

  const [perfilesRes, fotosRes] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from('perfiles').select('id, nombre_completo, numero_casilla').in('id', clienteIds)
      : Promise.resolve({ data: [] }),
    paqueteIds.length > 0
      ? supabase.from('fotos_paquetes').select('paquete_id, url').in('paquete_id', paqueteIds).order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string }> =
    Object.fromEntries((perfilesRes.data ?? []).map((p: { id: string; nombre_completo: string; numero_casilla: string }) => [p.id, p]))

  // Primera foto por paquete
  const fotosMap: Record<string, string> = {}
  for (const f of (fotosRes.data ?? []) as { paquete_id: string; url: string }[]) {
    if (!fotosMap[f.paquete_id]) fotosMap[f.paquete_id] = f.url
  }

  // Filtro de búsqueda por texto (incluye nombre tal como aparece en la etiqueta del courier)
  const filtrados = q
    ? lista.filter(p => {
        const perfil = p.cliente_id ? perfilesMap[p.cliente_id] : null
        const txt = `${p.tracking_casilla} ${p.descripcion} ${p.tienda} ${p.nombre_etiqueta ?? ''} ${perfil?.nombre_completo ?? ''} ${perfil?.numero_casilla ?? ''}`.toLowerCase()
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
            placeholder="Buscar tracking, cliente, producto o nombre en etiqueta..."
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
        <select
          name="asignacion"
          defaultValue={asignacion ?? ''}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Asignados y sin asignar</option>
          <option value="sin_asignar">⏳ Solo sin asignar</option>
          <option value="asignados">✓ Solo asignados</option>
        </select>
        <select
          name="consolidacion"
          defaultValue={consolidacion ?? ''}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Consolidación: cualquiera</option>
          <option value="requiere">📦 Requiere consolidar</option>
          <option value="despachable">🚀 Listo para despachar</option>
        </select>
        <button
          type="submit"
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          Filtrar
        </button>
        {(estado || bodega || q || asignacion || consolidacion) && (
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tiempo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Bodega</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Peso / Valor / Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {errPaq ? `Error: ${errPaq.message}` : 'No hay paquetes con esos filtros'}
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const perfil = p.cliente_id ? perfilesMap[p.cliente_id] : null
                  const peso = p.peso_facturable ?? p.peso_libras
                  const fotoUrl = fotosMap[p.id]
                  const diasEnBodega = p.fecha_recepcion_usa
                    ? Math.floor((Date.now() - new Date(p.fecha_recepcion_usa).getTime()) / 86_400_000)
                    : null
                  return (
                    <tr key={p.id} className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${!perfil ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fotoUrl ? (
                            <a href={fotoUrl} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 group relative"
                              title="Ver foto en tamaño completo"
                            >
                              <img src={fotoUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-gray-200 group-hover:opacity-80 transition-opacity" />
                              <div className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                <Camera className="h-3.5 w-3.5 text-white" />
                              </div>
                            </a>
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Camera className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                          <Link href={`/admin/paquetes/${p.id}`} className="min-w-0 block">
                            {diasEnBodega !== null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                                diasEnBodega > 14
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : diasEnBodega > 7
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                {diasEnBodega === 0 ? '🕐 Hoy' : `⏱ ${diasEnBodega}d`}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 italic">Sin fecha</span>
                            )}
                            {p.requiere_consolidacion && (
                              <span
                                className="block text-[10px] text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded mt-1 w-fit"
                                title={p.notas_consolidacion ?? 'Cliente solicitó consolidar con otros paquetes'}
                              >
                                📦 Consolidar
                              </span>
                            )}
                          </Link>
                        </div>
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
                        <div className="space-y-0.5">
                          {peso ? (
                            <p className="text-gray-700 font-medium">{peso} lb</p>
                          ) : (
                            <p className="text-gray-300 text-xs">Sin pesar</p>
                          )}
                          {p.valor_declarado ? (
                            <p className="text-xs font-semibold text-green-700">
                              ${Number(p.valor_declarado).toFixed(2)} USD
                            </p>
                          ) : null}
                          {p.costo_servicio ? (
                            <p className={`text-xs font-semibold ${p.factura_pagada ? 'text-green-600' : 'text-red-500'}`}>
                              ${p.costo_servicio} {p.factura_pagada ? '✓' : 'pendiente'}
                            </p>
                          ) : null}
                        </div>
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
