'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Box, MapPin, Package, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const tw = 'rgba(255,255,255,'

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
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: '#34d399' }} />
          <span className="text-sm font-semibold" style={{ color: `${tw}0.7)` }}>
            Historial de cajas recibidas en Colombia
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
            {cajas.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: `${tw}0.55)` }}>
            <input
              type="checkbox"
              checked={verTodos}
              onChange={e => setVerTodos(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
              style={{ accentColor: '#34d399' }}
            />
            Ver todas
          </label>
          <button
            onClick={cargar}
            className="transition-colors"
            style={{ color: `${tw}0.35)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-sm flex items-center justify-center gap-2"
          style={{ color: `${tw}0.35)` }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
        </div>
      ) : cajas.length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: `${tw}0.35)` }}>
          <Box className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>{verTodos ? 'Aún no has recibido cajas en Colombia.' : 'No has recibido cajas en los últimos 30 días.'}</p>
          {!verTodos && (
            <p className="text-[11px] mt-1" style={{ color: `${tw}0.25)` }}>
              Activa &quot;Ver todas&quot; para historial completo
            </p>
          )}
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto">
          {cajas.map(caja => (
            <Link
              key={caja.id}
              href={`/admin/cajas/${caja.id}`}
              className="block px-5 py-3 transition-colors group"
              style={{ borderTop: `1px solid ${tw}0.05)` }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-start gap-3 flex-wrap">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#34d399' }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-white">
                      {caja.codigo_interno}
                    </span>
                    {caja.tracking_usaco && (
                      <span className="text-xs font-mono" style={{ color: '#F5B800' }}>
                        USACO: {caja.tracking_usaco}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs" style={{ color: `${tw}0.45)` }}>
                    <span className="flex items-center gap-0.5">
                      <Package className="h-3 w-3" />
                      <strong style={{ color: `${tw}0.7)` }}>{caja.paquetes_count}</strong> paquete{caja.paquetes_count !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: `${tw}0.2)` }}>·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
                    </span>
                    {caja.peso_real && (
                      <>
                        <span style={{ color: `${tw}0.2)` }}>·</span>
                        <span>{Number(caja.peso_real).toFixed(1)} lb</span>
                      </>
                    )}
                    {caja.courier && (
                      <>
                        <span style={{ color: `${tw}0.2)` }}>·</span>
                        <span>{caja.courier}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {caja.paquetes_en_bodega > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                        🎁 {caja.paquetes_en_bodega} en bodega
                      </span>
                    )}
                    {caja.paquetes_entregados > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                        ✅ {caja.paquetes_entregados} entregados
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] flex-shrink-0 whitespace-nowrap" style={{ color: `${tw}0.35)` }}>
                  {caja.fecha_recepcion_colombia && (
                    <p>Recibida {format(new Date(caja.fecha_recepcion_colombia), "d MMM, HH:mm", { locale: es })}</p>
                  )}
                  {caja.fecha_despacho && (
                    <p style={{ color: `${tw}0.25)` }}>
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
