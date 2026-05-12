'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Box, MapPin, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

const tw = 'rgba(255,255,255,'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const ESTADO_BD_LABELS: Record<string, string> = {
  abierta: 'Abierta', cerrada: 'Cerrada', despachada: 'Despachada', recibida_colombia: 'Recibida CO',
}

interface Fila {
  caja_id: string
  codigo_interno: string
  tracking_usaco: string
  tipo: 'correo' | 'manejo'
  bodega_destino: string
  estado_bd: string
  estado_usaco_bd: string | null
  estado_usaco_api: string | null
  reconocida: boolean
  sincronizado: boolean | null
  created_at: string
  fecha_despacho: string | null
}

interface Resultado {
  ok: boolean
  filas: Fila[]
  total_bd: number
  reconocidas: number
  no_reconocidas: number
  desincronizadas: number
  consultadas_usaco: number
}

type Filtro = 'todas' | 'reconocidas' | 'no_reconocidas' | 'desincronizadas'

export default function UsacoCompararPage() {
  const [data, setData] = useState<Resultado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [ultimaConsulta, setUltimaConsulta] = useState<Date | null>(null)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/admin/usaco/comparar')
      const json = await res.json() as Resultado & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Error consultando'); return }
      setData(json)
      setUltimaConsulta(new Date())
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const filasFiltradas = (data?.filas ?? []).filter(f => {
    if (filtro === 'reconocidas') return f.reconocida
    if (filtro === 'no_reconocidas') return !f.reconocida
    if (filtro === 'desincronizadas') return f.reconocida && !f.sincronizado
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="h-6 w-6" style={{ color: '#F5B800' }} />
            Auditoría USACO
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            Cruza nuestras cajas con guía USACO contra la API en tiempo real
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}
        >
          <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          {cargando ? 'Consultando USACO...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Resumen */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total en BD', value: data.total_bd, color: `${tw}0.7)`, bg: `${tw}0.05)`, border: `${tw}0.1)`, key: 'todas' as Filtro },
            { label: 'Reconocidas por USACO', value: data.reconocidas, color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', key: 'reconocidas' as Filtro },
            { label: 'No reconocidas', value: data.no_reconocidas, color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', key: 'no_reconocidas' as Filtro },
            { label: 'Desincronizadas', value: data.desincronizadas, color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', key: 'desincronizadas' as Filtro },
          ].map(stat => (
            <button
              key={stat.key}
              onClick={() => setFiltro(filtro === stat.key ? 'todas' : stat.key)}
              className="p-4 rounded-2xl text-left transition-all"
              style={{
                background: filtro === stat.key ? stat.bg : `${tw}0.03)`,
                border: `1px solid ${filtro === stat.key ? stat.border : `${tw}0.07)`}`,
                boxShadow: filtro === stat.key ? `0 0 0 1px ${stat.border}` : 'none',
              }}
            >
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: `${tw}0.45)` }}>{stat.label}</p>
            </button>
          ))}
        </div>
      )}

      {ultimaConsulta && (
        <p className="text-xs" style={{ color: `${tw}0.3)` }}>
          Última consulta: {formatDistanceToNow(ultimaConsulta, { locale: es, addSuffix: true })}
        </p>
      )}

      {/* Tabla */}
      {cargando && !data && (
        <div className="flex items-center justify-center py-20" style={{ color: `${tw}0.35)` }}>
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Consultando USACO...</span>
        </div>
      )}

      {data && filasFiltradas.length === 0 && (
        <div className="text-center py-16" style={{ color: `${tw}0.35)` }}>
          <p className="text-sm">No hay cajas con ese filtro.</p>
        </div>
      )}

      {filasFiltradas.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tw}0.08)` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: `${tw}0.04)`, borderBottom: `1px solid ${tw}0.08)` }}>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Caja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Tracking USACO</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Destino</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Estado BD</th>
                <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Estado USACO API</th>
                <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: `${tw}0.4)` }}>Match</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((fila, i) => (
                <tr
                  key={fila.caja_id}
                  style={{
                    borderBottom: i < filasFiltradas.length - 1 ? `1px solid ${tw}0.05)` : 'none',
                    background: !fila.reconocida ? 'rgba(239,68,68,0.03)' : fila.sincronizado === false ? 'rgba(249,115,22,0.03)' : 'transparent',
                  }}
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/cajas/${fila.caja_id}`} className="group flex items-center gap-1">
                      <span className="font-mono text-xs text-white group-hover:text-yellow-400 transition-colors">
                        {fila.codigo_interno}
                      </span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#F5B800' }} />
                    </Link>
                    <p className="text-[10px] mt-0.5" style={{ color: `${tw}0.3)` }}>
                      {formatDistanceToNow(new Date(fila.created_at), { locale: es, addSuffix: true })}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="font-mono text-xs" style={{ color: '#F5B800' }}>{fila.tracking_usaco}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={fila.tipo === 'manejo'
                        ? { background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }
                        : { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                      {fila.tipo === 'manejo' ? 'Manejo' : 'Correo'}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: `${tw}0.5)` }}>
                      <MapPin className="h-3 w-3" />
                      {BODEGA_LABELS[fila.bodega_destino] ?? fila.bodega_destino}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${tw}0.06)`, color: `${tw}0.6)`, border: `1px solid ${tw}0.1)` }}>
                      {ESTADO_BD_LABELS[fila.estado_bd] ?? fila.estado_bd}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {fila.reconocida && fila.estado_usaco_api ? (
                      <span className="text-xs" style={{ color: '#4ade80' }}>{fila.estado_usaco_api}</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#f87171' }}>No encontrada</span>
                    )}
                    {fila.reconocida && fila.estado_usaco_bd && fila.estado_usaco_bd !== fila.estado_usaco_api && (
                      <p className="text-[10px] mt-0.5" style={{ color: `${tw}0.35)` }}>
                        BD tiene: {fila.estado_usaco_bd}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {!fila.reconocida && (
                      <span title="USACO no reconoce esta guía">
                        <XCircle className="h-4 w-4 mx-auto" style={{ color: '#f87171' }} />
                      </span>
                    )}
                    {fila.reconocida && fila.sincronizado && (
                      <span title="Estado sincronizado">
                        <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: '#4ade80' }} />
                      </span>
                    )}
                    {fila.reconocida && !fila.sincronizado && (
                      <span title="Estado desincronizado con BD">
                        <AlertTriangle className="h-4 w-4 mx-auto" style={{ color: '#fb923c' }} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
