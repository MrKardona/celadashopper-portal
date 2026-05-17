'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Package, RefreshCw, ChevronDown, ChevronUp,
  Loader2, MapPin, X, ExternalLink, ShoppingBag,
  Tag, Store, DollarSign, Hash, CalendarDays, MessageSquare,
  PackageCheck,
} from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'

const tw = 'rgba(255,255,255,'

const BODEGA_LABELS: Record<string, string> = {
  medellin:     'Medellín',
  bogota:       'Bogotá',
  barranquilla: 'Barranquilla',
}

const BODEGA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  medellin:     { bg: 'rgba(52,211,153,0.1)',  text: '#34d399', border: 'rgba(52,211,153,0.25)' },
  bogota:       { bg: 'rgba(99,130,255,0.1)',  text: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  barranquilla: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
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

function fechaCorta(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
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
  valor_declarado?: number | null
  cantidad?: number | null
  fecha_compra?: string | null
  fecha_estimada_llegada?: string | null
  created_at: string
  cliente: { nombre_completo: string; numero_casilla: string | null; ciudad: string | null } | null
}

interface Props {
  refreshKey?: number
  onSelectTracking?: (tracking: string) => void
}

// ─── Modal de detalles ────────────────────────────────────────────────────────
function ModalDetalle({
  paquete,
  onClose,
  onRecibir,
}: {
  paquete: PaquetePendiente
  onClose: () => void
  onRecibir?: (tracking: string) => void
}) {
  const bodegaStyle = BODEGA_COLORS[paquete.bodega_destino] ?? BODEGA_COLORS.bogota
  const tracking = paquete.tracking_casilla ?? paquete.tracking_origen ?? ''

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function FilaDetalle({ icon, label, valor, mono = false, accent = false }: {
    icon: React.ReactNode
    label: string
    valor: React.ReactNode
    mono?: boolean
    accent?: boolean
  }) {
    return (
      <div className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
        <div className="mt-0.5 flex-shrink-0" style={{ color: `${tw}0.3)` }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs mb-0.5" style={{ color: `${tw}0.35)` }}>{label}</p>
          <p
            className={`text-sm font-semibold break-all ${mono ? 'font-mono' : ''}`}
            style={{ color: accent ? '#F5B800' : `${tw}0.85)` }}
          >
            {valor}
          </p>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60 }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: '#12122a',
          borderLeft: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${tw}0.07)` }}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.25)' }}>
              <span className="text-sm font-bold" style={{ color: '#c084fc' }}>
                {paquete.cliente?.nombre_completo?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {paquete.cliente?.nombre_completo ?? 'Sin cliente'}
              </p>
              {paquete.cliente?.numero_casilla && (
                <p className="text-xs font-mono" style={{ color: '#F5B800' }}>
                  {paquete.cliente.numero_casilla}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: `${tw}0.35)` }}
            onMouseEnter={e => { e.currentTarget.style.color = `${tw}0.7)`; e.currentTarget.style.background = `${tw}0.06)` }}
            onMouseLeave={e => { e.currentTarget.style.color = `${tw}0.35)`; e.currentTarget.style.background = 'transparent' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto px-5 py-2">

          {/* Badge de bodega + tiempo */}
          <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1"
              style={{ background: bodegaStyle.bg, color: bodegaStyle.text, border: `1px solid ${bodegaStyle.border}` }}>
              <MapPin className="h-2.5 w-2.5" />
              {BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino}
            </span>
            <span className="text-xs" style={{ color: `${tw}0.3)` }}>
              Reportado {tiempoDesde(paquete.created_at)}
            </span>
          </div>

          {/* Tracking casilla — destacado */}
          {paquete.tracking_casilla && (
            <div className="my-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#F5B800' }}>
                Número CeladaShopper
              </p>
              <p className="font-mono text-xl font-bold" style={{ color: '#F5B800' }}>
                {paquete.tracking_casilla}
              </p>
            </div>
          )}

          {/* Detalles del paquete */}
          <div>
            <FilaDetalle
              icon={<ShoppingBag className="h-3.5 w-3.5" />}
              label="Descripción"
              valor={paquete.descripcion}
            />
            <FilaDetalle
              icon={<Store className="h-3.5 w-3.5" />}
              label="Tienda"
              valor={paquete.tienda}
            />
            <FilaDetalle
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Categoría"
              valor={CATEGORIA_LABELS[paquete.categoria] ?? paquete.categoria}
            />
            {paquete.valor_declarado != null && (
              <FilaDetalle
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Valor declarado"
                valor={`$${paquete.valor_declarado.toLocaleString('es-CO')} USD`}
              />
            )}
            {paquete.cantidad != null && (
              <FilaDetalle
                icon={<Hash className="h-3.5 w-3.5" />}
                label="Cantidad"
                valor={String(paquete.cantidad)}
              />
            )}
            {paquete.tracking_origen && (
              <FilaDetalle
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                label="Tracking del courier (origen)"
                valor={paquete.tracking_origen}
                mono
              />
            )}
            {paquete.fecha_compra && (
              <FilaDetalle
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Fecha de compra"
                valor={fechaCorta(paquete.fecha_compra)}
              />
            )}
            {paquete.fecha_estimada_llegada && (
              <FilaDetalle
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Llegada estimada a Miami"
                valor={fechaCorta(paquete.fecha_estimada_llegada)}
              />
            )}
            {paquete.cliente?.ciudad && (
              <FilaDetalle
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Ciudad del cliente"
                valor={paquete.cliente.ciudad}
              />
            )}
          </div>

          {/* Notas del cliente */}
          {paquete.notas_cliente && (
            <div className="mt-3 mb-2 rounded-xl px-4 py-3"
              style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.07)` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5" style={{ color: '#c084fc' }} />
                <p className="text-xs font-semibold" style={{ color: '#c084fc' }}>Notas del cliente</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: `${tw}0.65)` }}>
                {paquete.notas_cliente}
              </p>
            </div>
          )}
        </div>

        {/* Footer con botón recibir */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: `1px solid ${tw}0.07)` }}>
          {tracking && onRecibir ? (
            <button
              onClick={() => { onRecibir(tracking); onClose() }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.15)')}
            >
              <PackageCheck className="h-4 w-4" />
              Recibir este paquete →
            </button>
          ) : (
            <p className="text-xs text-center" style={{ color: `${tw}0.25)` }}>
              Sin tracking asignado — no se puede recibir directamente
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function PaquetesPendientes({ refreshKey = 0, onSelectTracking }: Props) {
  const [paquetes, setPaquetes]       = useState<PaquetePendiente[]>([])
  const [cargando, setCargando]       = useState(true)
  const [expandido, setExpandido]     = useState(true)
  const [ultimoRefresh, setUltimoRefresh] = useState(Date.now())
  const [seleccionado, setSeleccionado]   = useState<PaquetePendiente | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/recibir/pendientes')
      const data = await res.json() as { paquetes?: PaquetePendiente[] }
      setPaquetes(data.paquetes ?? [])
      setUltimoRefresh(Date.now())
    } catch { /* silencioso */ }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar, refreshKey])
  useEffect(() => {
    const id = setInterval(cargar, 60_000)
    return () => clearInterval(id)
  }, [cargar])

  const minutos = Math.floor((Date.now() - ultimoRefresh) / 60000)

  return (
    <>
      <div className="glass-card overflow-hidden">
        {/* Header collapsible */}
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

        {/* Lista */}
        {expandido && (
          <div>
            {paquetes.length === 0 && !cargando ? (
              <div className="px-5 py-8 text-center">
                <Package className="h-8 w-8 mx-auto mb-2" style={{ color: `${tw}0.15)` }} />
                <p className="text-sm" style={{ color: `${tw}0.3)` }}>No hay paquetes reportados pendientes</p>
                <p className="text-xs mt-1" style={{ color: `${tw}0.2)` }}>
                  Cuando los clientes reporten un paquete aparecerá aquí
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {paquetes.map(p => (
                  <FilaPendiente
                    key={p.id}
                    paquete={p}
                    onOpen={() => setSeleccionado(p)}
                    onSelect={onSelectTracking}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal lateral */}
      {seleccionado && (
        <ModalDetalle
          paquete={seleccionado}
          onClose={() => setSeleccionado(null)}
          onRecibir={onSelectTracking}
        />
      )}
    </>
  )
}

// ─── Fila de la lista ─────────────────────────────────────────────────────────
function FilaPendiente({
  paquete,
  onOpen,
  onSelect,
}: {
  paquete: PaquetePendiente
  onOpen: () => void
  onSelect?: (tracking: string) => void
}) {
  const bodegaStyle = BODEGA_COLORS[paquete.bodega_destino] ?? BODEGA_COLORS.bogota
  const tracking = paquete.tracking_casilla ?? paquete.tracking_origen ?? ''
  const clickable = !!tracking && !!onSelect

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="px-5 py-3 flex items-center gap-3 text-sm cursor-pointer transition-all"
      style={{ borderTop: `1px solid ${tw}0.05)` }}
      onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.04)`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar inicial cliente */}
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
          <span className="text-xs truncate" style={{ color: `${tw}0.45)` }}>{paquete.descripcion}</span>
          <span style={{ color: `${tw}0.2)` }}>·</span>
          <span className="text-xs" style={{ color: `${tw}0.35)` }}>{paquete.tienda}</span>
          {paquete.categoria && (
            <>
              <span style={{ color: `${tw}0.2)` }}>·</span>
              <span className="text-xs" style={{ color: `${tw}0.3)` }}>{CATEGORIA_LABELS[paquete.categoria]}</span>
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
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: bodegaStyle.bg, color: bodegaStyle.text, border: `1px solid ${bodegaStyle.border}` }}>
          <MapPin className="h-2.5 w-2.5" />
          {BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino}
        </span>
        <span className="text-[10px]" style={{ color: `${tw}0.3)` }}>
          {tiempoDesde(paquete.created_at)}
        </span>
        {clickable && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onSelect(tracking) }}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,132,252,0.1)')}
          >
            Recibir →
          </button>
        )}
      </div>
    </div>
  )
}
