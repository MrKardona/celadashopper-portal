'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Box, MapPin, Package, CheckCircle2, Loader2, RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CajaHistorial {
  id: string
  codigo_interno: string
  tracking_usaco: string | null
  courier: string | null
  bodega_destino: string
  peso_estimado: number | string | null
  peso_real: number | string | null
  costo_total_usaco: number | string | null
  notas: string | null
  created_at: string
  fecha_despacho: string | null
  fecha_recepcion_colombia: string | null
  paquetes_count: number
  paquetes_entregados: number
  paquetes_en_bodega: number
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

interface Props {
  refreshKey?: number
}

export default function HistorialRecibidasColombia({ refreshKey = 0 }: Props) {
  const [cajas, setCajas] = useState<CajaHistorial[]>([])
  const [cargando, setCargando] = useState(true)
  const [verTodos, setVerTodos] = useState(false)

  async function cargar() {
    setCargando(true)
    const params = new URLSearchParams()
    if (verTodos) params.set('todos', '1')
    else params.set('dias', '30')
    const res = await fetch(`/api/admin/recibir-colombia/historial?${params}`)
    const data = await res.json() as { cajas?: CajaHistorial[] }
    setCajas(data.cajas ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verTodos, refreshKey])

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold text-gray-700">
            Historial de cajas recibidas en Colombia
          </span>
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
            {cajas.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={verTodos}
              onChange={e => setVerTodos(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            Ver todas
          </label>
          <button
            onClick={cargar}
            className="text-gray-400 hover:text-gray-700"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
        </div>
      ) : cajas.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <Box className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{verTodos ? 'Aún no has recibido cajas en Colombia.' : 'No has recibido cajas en los últimos 30 días.'}</p>
          {!verTodos && (
            <p className="text-[11px] mt-1">
              Activa &quot;Ver todas&quot; para historial completo
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
          {cajas.map(caja => (
            <Link
              key={caja.id}
              href={`/admin/cajas/${caja.id}`}
              className="block px-5 py-3 hover:bg-green-50/40 transition-colors group"
            >
              <div className="flex items-start gap-3 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900">
                      {caja.codigo_interno}
                    </span>
                    {caja.tracking_usaco && (
                      <span className="text-xs text-orange-600 font-mono">
                        USACO: {caja.tracking_usaco}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <Package className="h-3 w-3" />
                      <strong className="text-gray-700">{caja.paquetes_count}</strong> paquete{caja.paquetes_count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
                    </span>
                    {caja.peso_real && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{Number(caja.peso_real).toFixed(1)} lb</span>
                      </>
                    )}
                    {caja.courier && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{caja.courier}</span>
                      </>
                    )}
                  </div>
                  {/* Estado de los paquetes */}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {caja.paquetes_en_bodega > 0 && (
                      <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                        🎁 {caja.paquetes_en_bodega} en bodega
                      </span>
                    )}
                    {caja.paquetes_entregados > 0 && (
                      <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                        ✅ {caja.paquetes_entregados} entregados
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                  {caja.fecha_recepcion_colombia && (
                    <p>
                      Recibida {format(new Date(caja.fecha_recepcion_colombia), "d MMM, HH:mm", { locale: es })}
                    </p>
                  )}
                  {caja.fecha_despacho && (
                    <p className="text-gray-400">
                      Salió {format(new Date(caja.fecha_despacho), "d MMM", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
