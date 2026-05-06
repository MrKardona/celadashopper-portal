'use client'

// Botón + modal para sugerir cómo armar cajas óptimas con bin-packing.
// Llama a /api/admin/cajas/sugerir y deja que el admin elija qué cajas
// crear. Cada selección crea la caja vacía + agrega los paquetes en
// secuencia usando los endpoints existentes.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, X, Loader2, Box, Package, AlertCircle, CheckCircle2,
  DollarSign, MapPin, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({}) // key: bodega:idx
  const [creando, setCreando] = useState<string | null>(null) // key actual
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
      // Pre-seleccionar todas las cajas sugeridas
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

  // Crea una caja con los paquetes sugeridos: 1 POST a cajas + N POST a cajas/:id/paquetes
  async function crearCaja(bodega: string, paquetes: PaqueteSugerencia[]): Promise<string | null> {
    // 1. Crear caja vacía
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

    // 2. Agregar cada paquete (en serie para evitar carreras)
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
        // continuamos con los demás
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
      // Refrescar listado
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
      <Button
        type="button"
        onClick={abrir}
        className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Sugerir armado
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => !creando && setAbierto(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <h2 className="text-lg font-bold text-gray-900">Armado óptimo de cajas</h2>
              </div>
              <button
                type="button"
                onClick={() => !creando && setAbierto(false)}
                disabled={!!creando}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Configuración: max valor */}
            <div className="px-6 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
              <div className="flex items-center gap-2 text-sm text-violet-900">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Umbral alto valor:</span>
                <input
                  type="number"
                  min="1" max="10000" step="10"
                  value={maxValor}
                  onChange={e => setMaxValor(parseFloat(e.target.value) || 200)}
                  onBlur={() => recargarConMax(maxValor)}
                  className="w-24 px-2 py-1 border border-violet-300 rounded text-sm font-mono bg-white"
                />
                <span className="text-violet-700 text-xs">USD</span>
              </div>
              <button
                type="button"
                onClick={() => recargarConMax(maxValor)}
                disabled={cargando}
                className="text-xs text-violet-700 hover:text-violet-900 underline disabled:opacity-50"
              >
                Recalcular
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cargando ? (
                <div className="text-center py-12 text-gray-400">
                  <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                  Calculando armado óptimo...
                </div>
              ) : error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              ) : sugerencias && Object.keys(sugerencias).length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <Box className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No hay paquetes disponibles para sugerir cajas.
                </div>
              ) : sugerencias ? (
                <div className="space-y-6">
                  {Object.entries(sugerencias).map(([bodega, info]) => (
                    <div key={bodega}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <MapPin className="h-4 w-4 text-orange-600" />
                        <h3 className="font-bold text-gray-900">
                          Bodega {BODEGA_LABELS[bodega] ?? bodega}
                        </h3>
                        {(() => {
                          const normales = info.cajas.filter(c => c.tipo === 'normal').length
                          const altas = info.cajas.filter(c => c.tipo === 'alto_valor').length
                          return (
                            <>
                              {normales > 0 && (
                                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                  {normales} bajo ${maxValor}
                                </span>
                              )}
                              {altas > 0 && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  {altas} alto valor
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </div>

                      {info.cajas.length === 0 ? (
                        <p className="text-xs text-gray-400 italic ml-6 mb-3">
                          No hay paquetes con valor declarado disponibles para esta bodega.
                        </p>
                      ) : (
                        <div className="space-y-2 ml-2">
                          {info.cajas.map((caja, idx) => {
                            const key = `${bodega}:${idx}`
                            const seleccionada = !!seleccion[key]
                            const esAltoValor = caja.tipo === 'alto_valor'
                            return (
                              <div
                                key={key}
                                className={`border-2 rounded-lg overflow-hidden transition-colors ${
                                  esAltoValor
                                    ? seleccionada ? 'border-orange-300 bg-orange-50/40' : 'border-orange-200 bg-white'
                                    : seleccionada ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className={`px-4 py-2.5 flex items-center justify-between gap-2 border-b ${esAltoValor ? 'border-orange-100' : 'border-gray-100'}`}>
                                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={seleccionada}
                                      onChange={() => toggle(key)}
                                      className={`h-4 w-4 rounded border-gray-300 focus:ring-violet-500 ${esAltoValor ? 'text-orange-600' : 'text-violet-600'}`}
                                    />
                                    <Box className={`h-4 w-4 flex-shrink-0 ${esAltoValor ? 'text-orange-500' : 'text-violet-600'}`} />
                                    <span className="text-sm font-semibold text-gray-900">
                                      Caja {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="text-xs text-gray-500">·</span>
                                    <span className="text-sm font-bold text-gray-900">
                                      ${caja.total_valor.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      ({caja.paquetes.length} paquete{caja.paquetes.length !== 1 ? 's' : ''})
                                    </span>
                                    {esAltoValor && (
                                      <span className="text-[11px] text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                        Alto valor &gt;${maxValor}
                                      </span>
                                    )}
                                  </label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCrearUna(bodega, idx, caja)}
                                    disabled={!!creando}
                                    className={`h-7 text-xs gap-1 ${esAltoValor ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-violet-300 text-violet-700 hover:bg-violet-50'}`}
                                  >
                                    {creando === key
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <><CheckCircle2 className="h-3 w-3" /> Crear esta caja</>}
                                  </Button>
                                </div>
                                <ul className="divide-y divide-gray-50">
                                  {caja.paquetes.map(p => (
                                    <li key={p.id} className="px-4 py-2 text-xs flex items-center gap-3">
                                      <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                      <span className="font-mono text-orange-700 w-32 truncate">
                                        {p.tracking_casilla ?? '—'}
                                      </span>
                                      <span className="flex-1 text-gray-700 truncate">
                                        {p.descripcion}
                                      </span>
                                      <span className="text-gray-500 truncate flex items-center gap-1 max-w-[140px]">
                                        <User className="h-3 w-3 flex-shrink-0" />
                                        {p.cliente_nombre ?? <span className="italic text-amber-600">Sin cliente</span>}
                                      </span>
                                      <span className={`font-bold whitespace-nowrap ${p.valor_declarado > maxValor ? 'text-orange-600' : 'text-gray-900'}`}>
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
                        <div className="ml-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="flex items-start gap-2 text-xs text-amber-800">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">
                                {info.sin_valor.length} paquete{info.sin_valor.length !== 1 ? 's' : ''} sin valor declarado
                              </p>
                              <p className="text-amber-700 mt-0.5">
                                Asígnales un valor en <span className="font-mono">/admin/recibir</span> para incluirlos en el cálculo, o agrégalos manualmente a una caja.
                              </p>
                              <ul className="mt-2 space-y-0.5">
                                {info.sin_valor.slice(0, 5).map(p => (
                                  <li key={p.id} className="text-[11px] text-amber-700 truncate">
                                    • <span className="font-mono">{p.tracking_casilla}</span> — {p.descripcion}
                                    {p.cliente_nombre && <span className="text-amber-600"> ({p.cliente_nombre})</span>}
                                  </li>
                                ))}
                                {info.sin_valor.length > 5 && (
                                  <li className="text-[11px] text-amber-600 italic">…y {info.sin_valor.length - 5} más</li>
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
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-gray-500">
                {totalSeleccionadas} caja{totalSeleccionadas !== 1 ? 's' : ''} seleccionada{totalSeleccionadas !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAbierto(false)}
                  disabled={!!creando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleCrearTodas}
                  disabled={!!creando || totalSeleccionadas === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                >
                  {creando === 'todas'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                    : <><CheckCircle2 className="h-4 w-4" /> Crear {totalSeleccionadas > 0 ? `${totalSeleccionadas} ` : ''}caja{totalSeleccionadas !== 1 ? 's' : ''}</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
