'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, Package, RefreshCw, ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'

const tw = 'rgba(255,255,255,'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

const BODEGA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  medellin:      { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  bogota:        { bg: 'rgba(99,130,255,0.1)',  text: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  barranquilla:  { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
}

function tiempoDesde(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

interface PaquetePendiente {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string
  tienda: string
  categoria: CategoriaProducto
  bodega_destino: string
  notas_cliente: string | null
  created_at: string
  cliente: { nombre_completo: string; numero_casilla: string | null; ciudad: string | null } | null
}

interface Props {
  refreshKey?: number
  onSelectTracking?: (tracking: string) => void
}

export default function PaquetesPendientes({ refreshKey = 0, onSelectTracking }: Props) {
  const [paquetes, setPaquetes]   = useState<PaquetePendiente[]>([])
  const [cargando, setCargando]   = useState(true)
  const [expandido, setExpandido] = useState(true)
  const [ultimoRefresh, setUltimoRefresh] = useState(Date.now())

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/recibir/pendientes')
      const data = await res.json() as { paquetes?: PaquetePendiente[] }
      setPaquetes(data.paquetes ?? [])
      setUltimoRefresh(Date.now())
    } catch {
      /* silencioso */
    } finally {
      setCargando(false)
    }
  }, [])

  // Carga inicial + cuando llega un paquete nuevo (refreshKey)
  useEffect(() => { cargar() }, [cargar, refreshKey])

  // Auto-refresh cada 60s
  useEffect(() => {
    const id = setInterval(cargar, 60_000)
    return () => clearInterval(id)
  }, [cargar])

  const minutos = Math.floor((Date.now() - ultimoRefresh) / 60000)

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between transition-colors"
        style={{ borderBottom: expandido ? `1px solid ${tw}0.07)` : 'none' }}
        onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.02)`)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: '#c084fc' }} />
            <span className="text-sm font-semibold" style={{ color: `${tw}0.75)` }}>
              Reportados — esperando recibir
            </span>
          </div>
          {/* Badge contador */}
          {!cargando && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: paquetes.length > 0 ? 'rgba(192,132,252,0.15)' : `${tw}0.06)`,
                color:      paquetes.length > 0 ? '#c084fc' : `${tw}0.35)`,
                border:     `1px solid ${paquetes.length > 0 ? 'rgba(192,132,252,0.3)' : tw + '0.1)'}`,
              }}>
              {paquetes.length}
            </span>
          )}
          {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: `${tw}0.3)` }} />}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); cargar() }}
            disabled={cargando}
            className="p-1 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: `${tw}0.3)` }}
            onMouseEnter={e => { e.currentTarget.style.color = `${tw}0.6)`; e.currentTarget.style.background = `${tw}0.05)` }}
            onMouseLeave={e => { e.currentTarget.style.color = `${tw}0.3)`; e.currentTarget.style.background = 'transparent' }}
            title="Actualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs" style={{ color: `${tw}0.25)` }}>
            {minutos === 0 ? 'ahora' : `hace ${minutos}m`}
          </span>
          {expandido
            ? <ChevronUp className="h-4 w-4" style={{ color: `${tw}0.3)` }} />
            : <ChevronDown className="h-4 w-4" style={{ color: `${tw}0.3)` }} />}
        </div>
      </button>

      {/* Contenido */}
      {expandido && (
        <div>
          {paquetes.length === 0 && !cargando ? (
            <div className="px-5 py-8 text-center">
              <Package className="h-8 w-8 mx-auto mb-2" style={{ color: `${tw}0.15)` }} />
              <p className="text-sm" style={{ color: `${tw}0.3)` }}>
                No hay paquetes reportados pendientes
              </p>
              <p className="text-xs mt-1" style={{ color: `${tw}0.2)` }}>
                Cuando los clientes reporten un paquete aparecerá aquí
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ maxHeight: 320, overflowY: 'auto', divideColor: `${tw}0.05)` }}>
              {paquetes.map(p => (
                <FilaPendiente
                  key={p.id}
                  paquete={p}
                  onSelect={onSelectTracking}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilaPendiente({
  paquete,
  onSelect,
}: {
  paquete: PaquetePendiente
  onSelect?: (tracking: string) => void
}) {
  const bodegaStyle = BODEGA_COLORS[paquete.bodega_destino] ?? BODEGA_COLORS.bogota
  const tracking = paquete.tracking_casilla ?? paquete.tracking_origen ?? ''
  const clickable = !!tracking && !!onSelect

  return (
    <div
      className="px-5 py-3 flex items-center gap-3 text-sm transition-all"
      style={{ borderTop: `1px solid ${tw}0.05)` }}
      onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.03)`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar / inicial cliente */}
      <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.2)' }}>
        <span className="text-xs font-bold" style={{ color: '#c084fc' }}>
          {paquete.cliente?.nombre_completo?.[0]?.toUpperCase() ?? '?'}
        </span>
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white truncate">
            {paquete.cliente?.nombre_completo ?? '⏳ Sin cliente'}
          </span>
          {paquete.cliente?.numero_casilla && (
            <span className="font-mono text-xs" style={{ color: '#F5B800' }}>
              {paquete.cliente.numero_casilla}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-xs truncate" style={{ color: `${tw}0.45)` }}>
            {paquete.descripcion}
          </span>
          <span style={{ color: `${tw}0.2)` }}>·</span>
          <span className="text-xs" style={{ color: `${tw}0.35)` }}>
            {paquete.tienda}
          </span>
          {paquete.categoria && (
            <>
              <span style={{ color: `${tw}0.2)` }}>·</span>
              <span className="text-xs" style={{ color: `${tw}0.3)` }}>
                {CATEGORIA_LABELS[paquete.categoria]}
              </span>
            </>
          )}
        </div>
        {paquete.tracking_origen && (
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: `${tw}0.3)` }}>
            {paquete.tracking_origen}
          </p>
        )}
      </div>

      {/* Columna derecha */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {/* Bodega */}
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: bodegaStyle.bg, color: bodegaStyle.text, border: `1px solid ${bodegaStyle.border}` }}>
          <MapPin className="h-2.5 w-2.5" />
          {BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino}
        </span>

        {/* Tiempo desde reporte */}
        <span className="text-[10px]" style={{ color: `${tw}0.3)` }}>
          {tiempoDesde(paquete.created_at)}
        </span>

        {/* Botón recibir */}
        {clickable && (
          <button
            type="button"
            onClick={() => onSelect(tracking)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.1)')}
          >
            Recibir →
          </button>
        )}
      </div>
    </div>
  )
}
