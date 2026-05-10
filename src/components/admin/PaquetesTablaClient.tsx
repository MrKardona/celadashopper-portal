'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Package, CheckSquare, Square, X, AlertCircle, Loader2, Merge } from 'lucide-react'
import { ESTADO_LABELS, CATEGORIA_LABELS } from '@/types'
import FacturaBadge from '@/components/admin/FacturaBadge'

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  reportado:          { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' },
  recibido_usa:       { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff',               border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion:   { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800',               border: 'rgba(245,184,0,0.25)'  },
  listo_envio:        { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc',               border: 'rgba(168,85,247,0.3)'  },
  en_transito:        { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c',               border: 'rgba(251,146,60,0.3)'  },
  en_colombia:        { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee',               border: 'rgba(34,211,238,0.25)' },
  en_bodega_local:    { bg: 'rgba(99,130,255,0.10)',  color: '#818cf8',               border: 'rgba(99,130,255,0.25)' },
  en_camino_cliente:  { bg: 'rgba(132,204,22,0.10)',  color: '#a3e635',               border: 'rgba(132,204,22,0.25)' },
  entregado:          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399',               border: 'rgba(52,211,153,0.3)'  },
  retenido:           { bg: 'rgba(239,68,68,0.12)',   color: '#f87171',               border: 'rgba(239,68,68,0.3)'   },
  devuelto:           { bg: 'rgba(244,63,94,0.12)',   color: '#fb7185',               border: 'rgba(244,63,94,0.3)'   },
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface PaqueteRow {
  id: string
  tracking_casilla: string | null
  cliente_id: string | null
  descripcion: string | null
  tienda: string | null
  categoria: string | null
  estado: string
  bodega_destino: string | null
  peso_facturable: number | null
  peso_libras: number | null
  costo_servicio: number | null
  valor_declarado: number | null
  factura_id: string | null
  factura_pagada: boolean | null
  requiere_consolidacion: boolean | null
  notas_consolidacion: string | null
  nombre_etiqueta: string | null
  fecha_recepcion_usa: string | null
  cliente: { nombre_completo: string; numero_casilla: string } | null
  fotoUrl: string | null
}

interface Props {
  paquetes: PaqueteRow[]
  error?: string | null
  consolidacionMap?: Record<string, number>
}

function FotoThumb({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])
  return (
    <>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="flex-shrink-0 group relative">
        <img src={url} alt="" className="h-9 w-9 rounded-md object-cover border border-white/10 group-hover:opacity-80 transition-opacity" />
        <div className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
          <Camera className="h-3.5 w-3.5 text-white" />
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}>
          <button onClick={() => setOpen(false)}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <X className="h-5 w-5 text-white" />
          </button>
          <img src={url} alt="" onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>
      )}
    </>
  )
}

export default function PaquetesTablaClient({ paquetes, error, consolidacionMap = {} }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Estado fusión
  const [fusionando, setFusionando] = useState(false)
  const [fusionDesc, setFusionDesc] = useState('')
  const [fusionError, setFusionError] = useState('')
  const [fusionPending, setFusionPending] = useState(false)

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === paquetes.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paquetes.map(p => p.id)))
    }
  }

  const eliminarSeleccionados = async () => {
    setDeleteError('')
    const ids = [...selected]
    const res = await fetch('/api/admin/paquetes/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(data.error ?? 'Error al eliminar')
      return
    }
    setSelected(new Set())
    setConfirmando(false)
    startTransition(() => router.refresh())
  }

  const allSelected = paquetes.length > 0 && selected.size === paquetes.length
  const someSelected = selected.size > 0

  const selectedPaquetes = paquetes.filter(p => selected.has(p.id))
  const previewTrackings = selectedPaquetes.slice(0, 5).map(p => p.tracking_casilla ?? p.id.slice(0, 8))
  const restoCount = selectedPaquetes.length - previewTrackings.length

  // Fusión: solo si todos los seleccionados son del mismo cliente (no nulo)
  const clienteIdsSeleccionados = [...new Set(selectedPaquetes.map(p => p.cliente_id).filter(Boolean))]
  const puedenFusionarse = selected.size >= 2 && clienteIdsSeleccionados.length === 1

  function abrirFusion() {
    const desc = selectedPaquetes.map(p => p.descripcion).filter(Boolean).join(' / ')
    setFusionDesc(desc)
    setFusionError('')
    setFusionando(true)
  }

  async function ejecutarFusion() {
    setFusionError('')
    setFusionPending(true)
    try {
      const res = await fetch('/api/admin/paquetes/fusionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], descripcion: fusionDesc }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) {
        setFusionError(data.error ?? 'Error al fusionar')
        return
      }
      setSelected(new Set())
      setFusionando(false)
      startTransition(() => router.refresh())
    } catch {
      setFusionError('Error de red')
    } finally {
      setFusionPending(false)
    }
  }

  return (
    <div className="relative">
      {/* Barra flotante de selección */}
      {someSelected && (
        <div className="sticky top-4 z-30 mb-3 rounded-xl shadow-xl overflow-hidden"
          style={{ background: 'rgba(20,20,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>

          {/* Fila principal */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelected(new Set()); setConfirmando(false); setFusionando(false) }} className="text-white/40 hover:text-white/70 transition-colors">
                <X className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-white">
                {selected.size} paquete{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
              {selected.size >= 2 && !puedenFusionarse && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>· clientes distintos</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {puedenFusionarse && !fusionando && !confirmando && (
                <button
                  onClick={abrirFusion}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: 'rgba(99,130,255,0.15)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.35)' }}>
                  <Merge className="h-4 w-4" />
                  Fusionar
                </button>
              )}
              {!confirmando && !fusionando && (
                <button
                  onClick={() => { setDeleteError(''); setConfirmando(true); setFusionando(false) }}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              )}
            </div>
          </div>

          {/* Panel de confirmación: eliminar */}
          {confirmando && (
            <div className="px-4 pb-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-sm pt-2" style={{ color: '#f87171' }}>¿Eliminar estos {selected.size} paquetes?</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {previewTrackings.join(', ')}{restoCount > 0 && ` y ${restoCount} más`}
              </p>
              {deleteError && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{deleteError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={eliminarSeleccionados}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: '#ef4444', color: 'white' }}>
                  {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Eliminando...</> : `Sí, eliminar ${selected.size}`}
                </button>
                <button
                  onClick={() => { setConfirmando(false); setDeleteError('') }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Panel de fusión */}
          {fusionando && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(99,130,255,0.2)' }}>
              <p className="text-xs pt-3 font-semibold" style={{ color: '#8899ff' }}>
                Fusionar {selected.size} paquetes en uno solo
              </p>

              {/* Preview paquetes */}
              <div className="space-y-1">
                {selectedPaquetes.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <span style={{ color: 'rgba(99,130,255,0.6)', fontWeight: 600 }}>{i + 1}.</span>
                    <span className="truncate max-w-[280px]">{p.descripcion ?? '—'}</span>
                    {p.peso_libras && <span style={{ color: 'rgba(255,255,255,0.25)' }}>· {p.peso_libras} lb</span>}
                  </div>
                ))}
              </div>

              {/* Descripción resultante editable */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Descripción del paquete fusionado
                </label>
                <input
                  type="text"
                  value={fusionDesc}
                  onChange={e => setFusionDesc(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,130,255,0.3)' }}
                />
              </div>

              {/* Resumen */}
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Peso combinado: <strong className="text-white/55">
                  {selectedPaquetes.reduce((a, p) => a + (p.peso_libras ?? 0), 0).toFixed(2)} lb
                </strong>
                {' · '}
                Los demás paquetes se eliminarán.
              </p>

              {fusionError && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{fusionError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={ejecutarFusion}
                  disabled={fusionPending || !fusionDesc.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: 'rgba(99,130,255,0.2)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.4)' }}>
                  {fusionPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fusionando...</>
                    : <><Merge className="h-3.5 w-3.5" /> Confirmar fusión</>}
                </button>
                <button
                  onClick={() => { setFusionando(false); setFusionError('') }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${tw}0.07)`, background: `${tw}0.03)` }}>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
                    {allSelected
                      ? <CheckSquare className="h-4 w-4 text-red-400" />
                      : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Tiempo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: `${tw}0.35)` }}>Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Bodega</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Factura</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: `${tw}0.35)` }}>Peso / Valor / Costo</th>
              </tr>
            </thead>
            <tbody>
              {paquetes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12" style={{ color: `${tw}0.3)` }}>
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    {error ? `Error: ${error}` : 'No hay paquetes con esos filtros'}
                  </td>
                </tr>
              ) : (
                paquetes.map(p => {
                  const isSelected = selected.has(p.id)
                  const peso = p.peso_facturable ?? p.peso_libras
                  const diasEnBodega = p.fecha_recepcion_usa
                    ? Math.floor((Date.now() - new Date(p.fecha_recepcion_usa).getTime()) / 86_400_000)
                    : null

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${isSelected ? 'bg-red-500/[0.07]' : `cursor-pointer hover:bg-white/[0.04] ${!p.cliente_id ? 'bg-amber-500/[0.03]' : ''}`}`}
                      style={{ borderBottom: `1px solid ${tw}0.05)` }}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 w-10">
                        <button onClick={() => toggleOne(p.id)} className="flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-red-400" />
                            : <Square className="h-4 w-4" />}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.fotoUrl ? (
                            <FotoThumb url={p.fotoUrl} />
                          ) : (
                            <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                              <Camera className="h-4 w-4" style={{ color: `${tw}0.2)` }} />
                            </div>
                          )}
                          <Link href={`/admin/paquetes/${p.id}`} className="min-w-0 block">
                            {diasEnBodega !== null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                                diasEnBodega > 14
                                  ? 'bg-red-500/15 text-red-400 border-red-500/25'
                                  : diasEnBodega > 7
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                                    : 'bg-white/[0.06] border-white/10'
                              }`}
                              style={diasEnBodega <= 7 ? { color: `${tw}0.55)` } : {}}
                              >
                                {diasEnBodega === 0 ? '🕐 Hoy' : `⏱ ${diasEnBodega}d`}
                              </span>
                            ) : (
                              <span className="text-xs italic" style={{ color: `${tw}0.25)` }}>Sin fecha</span>
                            )}
                            {p.requiere_consolidacion && (
                              <span className="block text-[10px] px-1.5 py-0.5 rounded mt-1 w-fit"
                                style={{ background: 'rgba(99,130,255,0.15)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.25)' }}
                                title={p.notas_consolidacion ?? 'Cliente solicitó consolidar con otros paquetes'}>
                                📦 Consolidar
                              </span>
                            )}
                          </Link>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          {p.cliente ? (
                            <>
                              <p className="font-medium text-white truncate max-w-[140px]">{p.cliente.nombre_completo}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <p className="text-xs" style={{ color: `${tw}0.35)` }}>{p.cliente.numero_casilla}</p>
                                {p.cliente_id && (consolidacionMap[p.cliente_id] ?? 0) >= 2 && (
                                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded leading-none"
                                    style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                                    📦 {consolidacionMap[p.cliente_id]} en bodega
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                              ⏳ Sin asignar
                            </span>
                          )}
                        </Link>
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          <p className="truncate max-w-[180px]" style={{ color: `${tw}0.8)` }}>{p.descripcion}</p>
                          <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>{p.tienda}</p>
                        </Link>
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: `${tw}0.45)` }}>
                        {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS] ?? p.categoria}
                      </td>

                      <td className="px-4 py-3">
                        {(() => {
                          const s = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }
                          return (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                              {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                            </span>
                          )
                        })()}
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell capitalize" style={{ color: `${tw}0.45)` }}>
                        {BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino}
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell">
                        <FacturaBadge
                          facturaId={p.factura_id ?? null}
                          facturaPagada={p.factura_pagada ?? null}
                          costoServicio={p.costo_servicio ?? null}
                          size="xs"
                        />
                      </td>

                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <div className="space-y-0.5">
                          {peso
                            ? <p className="font-medium" style={{ color: `${tw}0.8)` }}>{peso} lb</p>
                            : <p className="text-xs italic" style={{ color: `${tw}0.2)` }}>Sin pesar</p>
                          }
                          {p.valor_declarado && (
                            <p className="text-xs font-semibold" style={{ color: '#34d399' }}>${Number(p.valor_declarado).toFixed(2)} USD</p>
                          )}
                          {p.costo_servicio && (
                            <p className={`text-xs font-semibold ${p.factura_pagada ? 'text-green-400' : 'text-red-400'}`}>
                              ${p.costo_servicio} {p.factura_pagada ? '✓' : 'pendiente'}
                            </p>
                          )}
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
