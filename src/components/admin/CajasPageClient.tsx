'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Box, Package, MapPin, Truck, Clock, Archive, X, Loader2,
  ExternalLink, ScanBarcode, Scale, DollarSign, FileText,
  CheckCircle2, Lock, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CATEGORIA_LABELS, ESTADO_LABELS, type CategoriaProducto, type EstadoPaquete } from '@/types'
import EliminarCajaIconButton from '@/components/admin/EliminarCajaIconButton'
import type { CajaDetalle, PaqueteCaja } from '@/components/admin/CajaDetalleForm'
import FotoThumb from '@/components/ui/FotoThumb'

const tw = 'rgba(255,255,255,'

const ESTADO_CAJA_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  abierta:           { bg: 'rgba(245,184,0,0.12)',  color: '#F5B800',  border: 'rgba(245,184,0,0.25)',  label: 'Abierta' },
  cerrada:           { bg: 'rgba(99,130,255,0.12)', color: '#8899ff',  border: 'rgba(99,130,255,0.25)', label: 'Cerrada' },
  despachada:        { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.25)', label: 'Despachada' },
  recibida_colombia: { bg: 'rgba(52,211,153,0.12)', color: '#34d399',  border: 'rgba(52,211,153,0.25)', label: 'Recibida en Colombia' },
}

const ESTADO_PAQ_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  reportado:         { bg: 'rgba(255,255,255,0.07)', color: `${tw}0.6)`,  border: `${tw}0.12)` },
  recibido_usa:      { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff',    border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion:  { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800',    border: 'rgba(245,184,0,0.25)'  },
  listo_envio:       { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc',    border: 'rgba(168,85,247,0.3)'  },
  en_transito:       { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c',    border: 'rgba(251,146,60,0.3)'  },
  en_colombia:       { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee',    border: 'rgba(34,211,238,0.25)' },
  en_bodega_local:   { bg: 'rgba(99,130,255,0.10)',  color: '#818cf8',    border: 'rgba(99,130,255,0.25)' },
  en_camino_cliente: { bg: 'rgba(132,204,22,0.10)',  color: '#a3e635',    border: 'rgba(132,204,22,0.25)' },
  entregado:         { bg: 'rgba(52,211,153,0.12)',  color: '#34d399',    border: 'rgba(52,211,153,0.3)'  },
  retenido:          { bg: 'rgba(239,68,68,0.12)',   color: '#f87171',    border: 'rgba(239,68,68,0.3)'   },
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

export interface CajaResumen {
  id: string
  codigo_interno: string
  tracking_usaco: string | null
  courier: string | null
  bodega_destino: string
  peso_estimado: number | null
  peso_real: number | null
  estado: string
  created_at: string
  fecha_despacho: string | null
  fecha_recepcion_colombia: string | null
}

interface Props {
  cajas: CajaResumen[]
  conteoMap: Record<string, number>
}

function MetaChip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
      style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.07)`, color: `${tw}0.6)` }}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#F5B800' }} />
      {children}
    </div>
  )
}

export default function CajasPageClient({ cajas, conteoMap }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<{ caja: CajaDetalle; paquetes: PaqueteCaja[] } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const activas   = cajas.filter(c => ['abierta', 'cerrada', 'despachada'].includes(c.estado))
  const historial = cajas.filter(c => c.estado === 'recibida_colombia')

  const cargarDetalle = useCallback(async (id: string) => {
    setCargando(true)
    setError('')
    setDetalle(null)
    try {
      const res = await fetch(`/api/admin/cajas/${id}`)
      const data = await res.json() as { caja?: CajaDetalle; paquetes?: PaqueteCaja[]; error?: string }
      if (!res.ok || !data.caja) { setError(data.error ?? 'Error cargando la caja'); return }
      setDetalle({ caja: data.caja, paquetes: data.paquetes ?? [] })
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }, [])

  function abrir(id: string) {
    setSelectedId(id)
    cargarDetalle(id)
  }

  function cerrar() {
    setSelectedId(null)
    setDetalle(null)
    setError('')
  }

  // Cerrar con Escape
  useEffect(() => {
    if (!selectedId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function CajaCard({ caja }: { caja: CajaResumen }) {
    const count = conteoMap[caja.id] ?? 0
    const s = ESTADO_CAJA_STYLE[caja.estado] ?? { bg: `${tw}0.08)`, color: `${tw}0.5)`, border: `${tw}0.12)` }
    const isSelected = selectedId === caja.id

    return (
      <div
        className="glass-card overflow-hidden relative group transition-all cursor-pointer"
        style={isSelected ? { borderColor: 'rgba(245,184,0,0.4)', boxShadow: '0 0 0 2px rgba(245,184,0,0.15)' } : {}}
        onClick={() => isSelected ? cerrar() : abrir(caja.id)}
      >
        {/* Botón eliminar — solo se muestra en hover, no propaga al click del card */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}>
          <EliminarCajaIconButton cajaId={caja.id} codigo={caja.codigo_interno} paquetesCount={count} />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-bold text-white">{caja.codigo_interno}</p>
              {caja.tracking_usaco && (
                <p className="text-xs font-mono mt-0.5" style={{ color: '#F5B800' }}>USACO: {caja.tracking_usaco}</p>
              )}
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap mr-8"
              style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs" style={{ color: `${tw}0.5)` }}>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              <strong className="text-white">{count}</strong> paquete{count !== 1 ? 's' : ''}
            </span>
            <span style={{ color: `${tw}0.2)` }}>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
            </span>
            {caja.peso_estimado && (
              <>
                <span style={{ color: `${tw}0.2)` }}>·</span>
                <span>{Number(caja.peso_estimado).toFixed(1)} lb</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-2"
            style={{ borderTop: `1px solid ${tw}0.06)`, color: `${tw}0.35)` }}>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(caja.created_at), { locale: es, addSuffix: true })}
            </span>
            {caja.estado === 'despachada' && caja.fecha_despacho && (
              <span className="flex items-center gap-1" style={{ color: '#c084fc' }}>
                <Truck className="h-3 w-3" />
                Despachada {format(new Date(caja.fecha_despacho), "d MMM", { locale: es })}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const grupos = [
    { key: 'abierta',    label: '📦 Armando',     sub: 'Cajas aún en preparación' },
    { key: 'cerrada',    label: '🔒 Listas',       sub: 'Cerradas y listas para despachar' },
    { key: 'despachada', label: '✈️ En tránsito',  sub: 'En camino a Colombia' },
  ]

  return (
    <div className="flex gap-6 items-start">
      {/* ── Lista de cajas ────────────────────────────────────── */}
      <div className={`flex-1 space-y-6 min-w-0 transition-all duration-300 ${selectedId ? 'max-w-[calc(100%-420px)]' : ''}`}>

        {activas.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Box className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
            <p style={{ color: `${tw}0.4)` }}>No hay cajas activas</p>
            <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Crea una nueva caja para consolidar paquetes</p>
          </div>
        ) : (
          grupos.map(grupo => {
            const cajaGrupo = activas.filter(c => c.estado === grupo.key)
            if (cajaGrupo.length === 0) return null
            const s = ESTADO_CAJA_STYLE[grupo.key]
            return (
              <div key={grupo.key}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-sm font-bold text-white">{grupo.label}</h2>
                  <span className="text-xs" style={{ color: `${tw}0.35)` }}>{grupo.sub}</span>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {cajaGrupo.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cajaGrupo.map(caja => <CajaCard key={caja.id} caja={caja} />)}
                </div>
              </div>
            )
          })
        )}

        {/* Atajo recibir Colombia */}
        <div className="glass-card p-4" style={{ borderColor: 'rgba(99,130,255,0.2)', background: 'rgba(99,130,255,0.05)' }}>
          <div className="flex items-start gap-3">
            <ScanBarcode className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#8899ff' }} />
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">¿Llegó una caja a Colombia?</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: `${tw}0.55)` }}>
                Usa el módulo de recepción Colombia para escanear el tracking USACO y procesar todos los paquetes en bloque.
              </p>
              <Link href="/admin/recibir-colombia" className="inline-block text-xs font-semibold mt-2" style={{ color: '#8899ff' }}>
                Ir a Recibir Colombia →
              </Link>
            </div>
          </div>
        </div>

        {/* Historial */}
        {historial.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4" style={{ color: `${tw}0.3)` }} />
                <h2 className="text-sm font-semibold" style={{ color: `${tw}0.4)` }}>Historial — Recibidas en Colombia</h2>
              </div>
              <div className="flex-1 h-px" style={{ background: `${tw}0.07)` }} />
              <span className="text-xs" style={{ color: `${tw}0.3)` }}>{historial.length} cajas</span>
            </div>
            <div className="glass-card overflow-hidden" style={{ opacity: 0.75 }}>
              <div className="divide-y" style={{ borderColor: `${tw}0.06)` }}>
                {historial.map(caja => {
                  const count = conteoMap[caja.id] ?? 0
                  const isSelected = selectedId === caja.id
                  return (
                    <button
                      key={caja.id}
                      type="button"
                      onClick={() => isSelected ? cerrar() : abrir(caja.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
                      style={{ background: isSelected ? 'rgba(245,184,0,0.05)' : 'transparent' }}
                      onMouseEnter={e => !isSelected && (e.currentTarget.style.background = `${tw}0.02)`)}
                      onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#34d399' }} />
                      <span className="font-mono text-xs text-white">{caja.codigo_interno}</span>
                      {caja.tracking_usaco && (
                        <span className="text-xs font-mono" style={{ color: '#F5B800' }}>{caja.tracking_usaco}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs ml-2" style={{ color: `${tw}0.4)` }}>
                        <Package className="h-3 w-3" />{count}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: `${tw}0.3)` }}>
                        <MapPin className="h-3 w-3" />{BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
                      </span>
                      <span className="ml-auto text-[10px]" style={{ color: `${tw}0.25)` }}>
                        {caja.fecha_recepcion_colombia
                          ? format(new Date(caja.fecha_recepcion_colombia), "d MMM yyyy", { locale: es })
                          : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel deslizante derecho ──────────────────────────── */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            key="panel-caja"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-[400px] flex-shrink-0 sticky top-6"
            style={{ maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}
          >
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(10,10,25,0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              }}>

              {/* Cargando */}
              {cargando && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#F5B800' }} />
                  <p className="text-sm" style={{ color: `${tw}0.4)` }}>Cargando caja...</p>
                </div>
              )}

              {/* Error */}
              {!cargando && error && (
                <div className="p-6 flex items-center gap-2 text-sm" style={{ color: '#f87171' }}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Contenido */}
              {!cargando && !error && detalle && (
                <PanelDetalle
                  caja={detalle.caja}
                  paquetes={detalle.paquetes}
                  onCerrar={cerrar}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Panel de detalle ───────────────────────────────────────────────────────────
function PanelDetalle({
  caja,
  paquetes,
  onCerrar,
}: {
  caja: CajaDetalle
  paquetes: PaqueteCaja[]
  onCerrar: () => void
}) {
  const s = ESTADO_CAJA_STYLE[caja.estado] ?? { bg: `${tw}0.08)`, color: `${tw}0.5)`, border: `${tw}0.12)`, label: caja.estado }
  const pesoTotal  = paquetes.reduce((acc, p) => acc + Number(p.peso_libras ?? 0), 0)
  const valorTotal = paquetes.reduce((acc, p) => acc + Number(p.valor_declarado ?? 0), 0)

  return (
    <>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-3" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            </div>
            <p className="font-mono text-base font-bold text-white mt-1.5 truncate">{caja.codigo_interno}</p>
            {caja.tracking_usaco && (
              <p className="text-xs font-mono mt-0.5 flex items-center gap-1" style={{ color: '#F5B800' }}>
                <Truck className="h-3 w-3" /> USACO: {caja.tracking_usaco}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link
              href={`/admin/cajas/${caja.id}`}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: `${tw}0.35)` }}
              title="Abrir página completa"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onCerrar}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: `${tw}0.35)` }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Meta chips */}
        <div className="grid grid-cols-2 gap-2">
          <MetaChip icon={MapPin}>
            {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
          </MetaChip>
          <MetaChip icon={Package}>
            <strong className="text-white">{paquetes.length}</strong>&nbsp;paquete{paquetes.length !== 1 ? 's' : ''}
          </MetaChip>
          {(caja.peso_real ?? caja.peso_estimado) && (
            <MetaChip icon={Scale}>
              {Number(caja.peso_real ?? caja.peso_estimado).toFixed(1)} lb
              <span className="text-[10px] ml-0.5" style={{ color: `${tw}0.3)` }}>
                {caja.peso_real ? 'real' : 'est.'}
              </span>
            </MetaChip>
          )}
          {pesoTotal > 0 && (
            <MetaChip icon={Scale}>
              <span style={{ color: `${tw}0.5)` }}>Σ paquetes&nbsp;</span>
              {pesoTotal.toFixed(1)} lb
            </MetaChip>
          )}
          {caja.courier && (
            <MetaChip icon={Truck}>{caja.courier}</MetaChip>
          )}
          {valorTotal > 0 && (
            <MetaChip icon={DollarSign}>
              ${valorTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
            </MetaChip>
          )}
          {caja.costo_total_usaco && (
            <MetaChip icon={DollarSign}>
              <span style={{ color: `${tw}0.5)` }}>USACO&nbsp;</span>
              ${Number(caja.costo_total_usaco).toFixed(2)}
            </MetaChip>
          )}
        </div>

        {caja.fecha_despacho && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: '#c084fc' }}>
            <Truck className="h-3 w-3" />
            Despachada {format(new Date(caja.fecha_despacho), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}

        {caja.notas && (
          <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2"
            style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.07)`, color: `${tw}0.5)` }}>
            <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#F5B800' }} />
            <span className="italic">{caja.notas}</span>
          </div>
        )}
      </div>

      {/* Lista de paquetes */}
      <div className="px-5 py-4 space-y-2">
        {paquetes.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Package className="h-8 w-8 mx-auto opacity-20 text-white" />
            <p className="text-sm" style={{ color: `${tw}0.3)` }}>Sin paquetes en esta caja</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ color: `${tw}0.3)`, letterSpacing: '0.12em' }}>
              Contenido
            </p>
            <div className="space-y-2">
              {paquetes.map(p => {
                const ps = ESTADO_PAQ_STYLE[p.estado] ?? { bg: `${tw}0.07)`, color: `${tw}0.5)`, border: `${tw}0.1)` }
                return (
                  <Link
                    key={p.id}
                    href={`/admin/paquetes/${p.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
                    style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.06)` }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.06)`)}
                    onMouseLeave={e => (e.currentTarget.style.background = `${tw}0.03)`)}
                  >
                    {/* Foto o ícono */}
                    <FotoThumb url={p.foto_url} alt={p.descripcion} width={40} height={40} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {p.descripcion}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.tracking_casilla && (
                          <span className="font-mono text-[10px]" style={{ color: '#F5B800' }}>{p.tracking_casilla}</span>
                        )}
                        <span style={{ color: `${tw}0.15)` }}>·</span>
                        <span className="text-[10px]" style={{ color: `${tw}0.4)` }}>
                          {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                        </span>
                        {Number(p.peso_libras) > 0 && (
                          <>
                            <span style={{ color: `${tw}0.15)` }}>·</span>
                            <span className="text-[10px]" style={{ color: `${tw}0.4)` }}>{Number(p.peso_libras).toFixed(1)} lb</span>
                          </>
                        )}
                      </div>
                      {p.cliente && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: `${tw}0.35)` }}>
                          {p.cliente.numero_casilla && (
                            <span className="font-mono" style={{ color: '#F5B800' }}>{p.cliente.numero_casilla} · </span>
                          )}
                          {p.cliente.nombre_completo}
                        </p>
                      )}
                    </div>

                    {/* Estado */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                      {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                    </span>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer — ir a página completa */}
      <div className="px-5 pb-5">
        <Link
          href={`/admin/cajas/${caja.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.1)')}
        >
          <Lock className="h-3.5 w-3.5" />
          Abrir caja completa — agregar / cerrar / despachar
        </Link>
      </div>
    </>
  )
}
