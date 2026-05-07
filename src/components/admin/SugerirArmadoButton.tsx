'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, X, Loader2, Box, Package, AlertCircle, CheckCircle2,
  DollarSign, MapPin, User,
} from 'lucide-react'

const tw = 'rgba(255,255,255,'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

interface PaqueteSugerencia {
  id: string
  tracking_casilla: string | null
  descripcion: string
  valor_declarado: number
  peso_libras: number | null
  cliente_nombre: string | null
}

interface PaqueteSinValor {
  id: string
  tracking_casilla: string | null
  descripcion: string
  cliente_nombre: string | null
}

interface CajaSugerida {
  bodega: string
  paquetes: PaqueteSugerencia[]
  total_valor: number
  tipo: 'normal' | 'alto_valor'
}

interface Sugerencias {
  [bodega: string]: {
    cajas: CajaSugerida[]
    sin_valor: PaqueteSinValor[]
  }
}

export default function SugerirArmadoButton() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [sugerencias, setSugerencias] = useState<Sugerencias | null>(null)
  const [maxValor, setMaxValor] = useState(200)
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({})
  const [creando, setCreando] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function abrir() {
    setAbierto(true)
    setError('')
    setSugerencias(null)
    setSeleccion({})
    await cargarSugerencias(maxValor)
  }

  async function cargarSugerencias(max: number) {
    setCargando(true)
    try {
      const res = await fetch(`/api/admin/cajas/sugerir?max_valor=${max}`)
      const data = await res.json() as { ok?: boolean; sugerencias?: Sugerencias; error?: string }
      if (!res.ok || !data.ok || !data.sugerencias) {
        setError(data.error ?? 'Error al cargar sugerencias')
        return
      }
      setSugerencias(data.sugerencias)
      const todas: Record<string, boolean> = {}
      for (const [bodega, info] of Object.entries(data.sugerencias)) {
        info.cajas.forEach((_, idx) => { todas[`${bodega}:${idx}`] = true })
      }
      setSeleccion(todas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setCargando(false)
    }
  }

  async function recargarConMax(nuevoMax: number) {
    setMaxValor(nuevoMax)
    await cargarSugerencias(nuevoMax)
  }

  function toggle(key: string) {
    setSeleccion(s => ({ ...s, [key]: !s[key] }))
  }

  async function crearCaja(bodega: string, paquetes: PaqueteSugerencia[]): Promise<string | null> {
    const resCaja = await fetch('/api/admin/cajas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodega_destino: bodega }),
    })
    const dataCaja = await resCaja.json() as { ok?: boolean; caja?: { id: string }; error?: string }
    if (!resCaja.ok || !dataCaja.ok || !dataCaja.caja) {
      throw new Error(dataCaja.error ?? 'No se pudo crear la caja')
    }
    const cajaId = dataCaja.caja.id
    for (const p of paquetes) {
      if (!p.tracking_casilla) continue
      const resAdd = await fetch(`/api/admin/cajas/${cajaId}/paquetes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking: p.tracking_casilla }),
      })
      const dataAdd = await resAdd.json() as { ok?: boolean; error?: string }
      if (!resAdd.ok || !dataAdd.ok) {
        console.warn(`[sugerir] no se pudo agregar ${p.tracking_casilla}: ${dataAdd.error}`)
      }
    }
    return cajaId
  }

  async function handleCrearUna(bodega: string, idx: number, caja: CajaSugerida) {
    const key = `${bodega}:${idx}`
    setCreando(key)
    setError('')
    try {
      const cajaId = await crearCaja(bodega, caja.paquetes)
      if (cajaId) router.push(`/admin/cajas/${cajaId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear caja')
    } finally {
      setCreando(null)
    }
  }

  async function handleCrearTodas() {
    if (!sugerencias) return
    setCreando('todas')
    setError('')
    let creadas = 0
    try {
      for (const [bodega, info] of Object.entries(sugerencias)) {
        for (let idx = 0; idx < info.cajas.length; idx++) {
          if (!seleccion[`${bodega}:${idx}`]) continue
          await crearCaja(bodega, info.cajas[idx].paquetes)
          creadas++
        }
      }
      router.refresh()
      setAbierto(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error al crear cajas (${creadas} creadas)`)
    } finally {
      setCreando(null)
    }
  }

  const totalSeleccionadas = Object.values(seleccion).filter(Boolean).length

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.12)')}
      >
        <Sparkles className="h-4 w-4" />
        Sugerir armado
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => !creando && setAbierto(false)}
        >
          <div
            className="max-w-3xl w-full my-8 flex flex-col max-h-[90vh]"
            style={{
              background: 'rgba(10,10,25,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${tw}0.1)`,
              borderRadius: '1rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: `1px solid ${tw}0.08)` }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" style={{ color: '#c084fc' }} />
                <h2 className="text-lg font-bold text-white">Armado óptimo de cajas</h2>
              </div>
              <button
                type="button"
                onClick={() => !creando && setAbierto(false)}
                disabled={!!creando}
                className="disabled:opacity-50 p-1 rounded-lg transition-colors"
                style={{ color: `${tw}0.4)` }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Configuración */}
            <div className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap flex-shrink-0"
              style={{ background: 'rgba(168,85,247,0.06)', borderBottom: `1px solid rgba(168,85,247,0.15)` }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: '#c084fc' }}>
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Umbral alto valor:</span>
                <input
                  type="number"
                  min="1" max="10000" step="10"
                  value={maxValor}
                  onChange={e => setMaxValor(parseFloat(e.target.value) || 200)}
                  onBlur={() => recargarConMax(maxValor)}
                  className="glass-input w-24 px-2 py-1 text-sm font-mono rounded-lg focus:outline-none"
                />
                <span className="text-xs" style={{ color: `${tw}0.4)` }}>USD</span>
              </div>
              <button
                type="button"
                onClick={() => recargarConMax(maxValor)}
                disabled={cargando}
                className="text-xs disabled:opacity-50 underline"
                style={{ color: '#c084fc' }}
              >
                Recalcular
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {cargando ? (
                <div className="text-center py-14 text-sm flex flex-col items-center gap-2"
                  style={{ color: `${tw}0.4)` }}>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Calculando armado óptimo...
                </div>
              ) : error ? (
                <div className="text-sm p-3 rounded-xl flex items-start gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              ) : sugerencias && Object.keys(sugerencias).length === 0 ? (
                <div className="text-center py-14 text-sm flex flex-col items-center gap-2"
                  style={{ color: `${tw}0.35)` }}>
                  <Box className="h-10 w-10 opacity-20" />
                  No hay paquetes disponibles para sugerir cajas.
                </div>
              ) : sugerencias ? (
                <div className="space-y-7">
                  {Object.entries(sugerencias).map(([bodega, info]) => (
                    <div key={bodega}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <MapPin className="h-4 w-4" style={{ color: '#F5B800' }} />
                        <h3 className="font-bold text-white">
                          Bodega {BODEGA_LABELS[bodega] ?? bodega}
                        </h3>
                        {(() => {
                          const normales = info.cajas.filter(c => c.tipo === 'normal').length
                          const altas = info.cajas.filter(c => c.tipo === 'alto_valor').length
                          return (
                            <>
                              {normales > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                                  {normales} bajo ${maxValor}
                                </span>
                              )}
                              {altas > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
                                  {altas} alto valor
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </div>

                      {info.cajas.length === 0 ? (
                        <p className="text-xs italic ml-6 mb-3" style={{ color: `${tw}0.35)` }}>
                          No hay paquetes con valor declarado disponibles para esta bodega.
                        </p>
                      ) : (
                        <div className="space-y-2 ml-2">
                          {info.cajas.map((caja, idx) => {
                            const key = `${bodega}:${idx}`
                            const seleccionada = !!seleccion[key]
                            const esAltoValor = caja.tipo === 'alto_valor'
                            const borderColor = esAltoValor
                              ? seleccionada ? 'rgba(245,184,0,0.4)' : 'rgba(245,184,0,0.18)'
                              : seleccionada ? 'rgba(168,85,247,0.4)' : `${tw}0.1)`
                            const bgColor = esAltoValor
                              ? seleccionada ? 'rgba(245,184,0,0.05)' : 'transparent'
                              : seleccionada ? 'rgba(168,85,247,0.05)' : 'transparent'
                            return (
                              <div
                                key={key}
                                className="rounded-xl overflow-hidden transition-colors"
                                style={{ border: `2px solid ${borderColor}`, background: bgColor }}
                              >
                                <div className="px-4 py-2.5 flex items-center justify-between gap-2"
                                  style={{ borderBottom: `1px solid ${tw}0.06)` }}>
                                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={seleccionada}
                                      onChange={() => toggle(key)}
                                      className="h-4 w-4 rounded"
                                      style={{ accentColor: esAltoValor ? '#F5B800' : '#c084fc' }}
                                    />
                                    <Box className="h-4 w-4 flex-shrink-0"
                                      style={{ color: esAltoValor ? '#F5B800' : '#c084fc' }} />
                                    <span className="text-sm font-semibold text-white">
                                      Caja {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span style={{ color: `${tw}0.25)` }}>·</span>
                                    <span className="text-sm font-bold text-white">
                                      ${caja.total_valor.toFixed(2)}
                                    </span>
                                    <span className="text-xs" style={{ color: `${tw}0.4)` }}>
                                      ({caja.paquetes.length} paquete{caja.paquetes.length !== 1 ? 's' : ''})
                                    </span>
                                    {esAltoValor && (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap"
                                        style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
                                        Alto valor &gt;${maxValor}
                                      </span>
                                    )}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleCrearUna(bodega, idx, caja)}
                                    disabled={!!creando}
                                    className="h-7 px-2.5 rounded-lg text-xs flex items-center gap-1 disabled:opacity-50 transition-colors"
                                    style={esAltoValor
                                      ? { background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }
                                      : { background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = esAltoValor ? 'rgba(245,184,0,0.18)' : 'rgba(168,85,247,0.18)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = esAltoValor ? 'rgba(245,184,0,0.1)' : 'rgba(168,85,247,0.1)')}
                                  >
                                    {creando === key
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><CheckCircle2 className="h-3 w-3" /> Crear esta caja</>}
                                  </button>
                                </div>
                                <ul>
                                  {caja.paquetes.map((p, pi) => (
                                    <li key={p.id} className="px-4 py-2 text-xs flex items-center gap-3"
                                      style={{ borderTop: pi > 0 ? `1px solid ${tw}0.04)` : undefined }}>
                                      <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.3)` }} />
                                      <span className="font-mono w-32 truncate" style={{ color: '#F5B800' }}>
                                        {p.tracking_casilla ?? '—'}
                                      </span>
                                      <span className="flex-1 truncate" style={{ color: `${tw}0.65)` }}>
                                        {p.descripcion}
                                      </span>
                                      <span className="truncate flex items-center gap-1 max-w-[140px]"
                                        style={{ color: `${tw}0.4)` }}>
                                        <User className="h-3 w-3 flex-shrink-0" />
                                        {p.cliente_nombre ?? <span style={{ color: '#F5B800', fontStyle: 'italic' }}>Sin cliente</span>}
                                      </span>
                                      <span className={`font-bold whitespace-nowrap`}
                                        style={{ color: p.valor_declarado > maxValor ? '#F5B800' : 'white' }}>
                                        ${p.valor_declarado.toFixed(2)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Sin valor declarado */}
                      {info.sin_valor.length > 0 && (
                        <div className="ml-2 mt-3 rounded-xl p-3"
                          style={{ background: 'rgba(245,184,0,0.06)', border: '1px solid rgba(245,184,0,0.18)' }}>
                          <div className="flex items-start gap-2 text-xs" style={{ color: '#F5B800' }}>
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">
                                {info.sin_valor.length} paquete{info.sin_valor.length !== 1 ? 's' : ''} sin valor declarado
                              </p>
                              <p className="mt-0.5" style={{ color: `${tw}0.5)` }}>
                                Asígnales un valor en <span className="font-mono">/admin/recibir</span> para incluirlos en el cálculo, o agrégalos manualmente a una caja.
                              </p>
                              <ul className="mt-2 space-y-0.5">
                                {info.sin_valor.slice(0, 5).map(p => (
                                  <li key={p.id} className="text-[11px] truncate" style={{ color: `${tw}0.45)` }}>
                                    • <span className="font-mono">{p.tracking_casilla}</span> — {p.descripcion}
                                    {p.cliente_nombre && <span style={{ color: `${tw}0.35)` }}> ({p.cliente_nombre})</span>}
                                  </li>
                                ))}
                                {info.sin_valor.length > 5 && (
                                  <li className="text-[11px] italic" style={{ color: `${tw}0.35)` }}>…y {info.sin_valor.length - 5} más</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
              style={{ borderTop: `1px solid ${tw}0.08)` }}>
              <p className="text-xs" style={{ color: `${tw}0.45)` }}>
                {totalSeleccionadas} caja{totalSeleccionadas !== 1 ? 's' : ''} seleccionada{totalSeleccionadas !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  disabled={!!creando}
                  className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCrearTodas}
                  disabled={!!creando || totalSeleccionadas === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40 transition-colors"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.15)')}
                >
                  {creando === 'todas'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                    : <><CheckCircle2 className="h-4 w-4" /> Crear {totalSeleccionadas > 0 ? `${totalSeleccionadas} ` : ''}caja{totalSeleccionadas !== 1 ? 's' : ''}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
