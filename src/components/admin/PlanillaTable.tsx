'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, RefreshCw, CheckCircle2, Loader2, FileText, Package } from 'lucide-react'

const tw = 'rgba(255,255,255,'

const TIPO_COLORS: Record<string, { color: string; bg: string }> = {
  personal:  { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  servicios: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  productos: { color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  paquete:   { color: '#F5B800', bg: 'rgba(245,184,0,0.10)'   },
}

type Dom  = { id: string; nombre_completo: string }
type Paq  = { id: string; tracking_casilla: string | null; tracking_origen: string | null; descripcion: string | null; cliente_nombre: string; domiciliario_id: string; updated_at: string; valor_domicilio: number | null }
type Man  = { id: string; nombre: string; direccion: string | null; tipo: string; domiciliario_id: string; completado_at: string; valor: number | null }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true })
}

function ValorCell({ tipo, id, inicial, onSave }: { tipo: 'paquete' | 'manual'; id: string; inicial: number | null; onSave: (tipo: 'paquete' | 'manual', id: string, valor: number | null) => Promise<void> }) {
  const [val,   setVal]   = useState(inicial !== null ? String(inicial) : '')
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync si llegan datos nuevos desde el servidor
  useEffect(() => {
    setVal(inicial !== null ? String(inicial) : '')
  }, [inicial])

  function handleChange(v: string) {
    setVal(v)
    setState('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const num = v.trim() === '' ? null : parseFloat(v)
      if (v.trim() !== '' && (isNaN(num!) || num! < 0)) return
      setState('saving')
      try {
        await onSave(tipo, id, num)
        setState('saved')
        setTimeout(() => setState('idle'), 1800)
      } catch {
        setState('error')
      }
    }, 600)
  }

  const borderColor =
    state === 'saved'  ? 'rgba(52,211,153,0.5)'  :
    state === 'error'  ? 'rgba(239,68,68,0.4)'   :
    state === 'saving' ? 'rgba(245,184,0,0.4)'   :
    `${tw}0.1)`

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: `${tw}0.3)` }}>$</span>
      <input
        type="number"
        min={0}
        step={100}
        value={val}
        onChange={e => handleChange(e.target.value)}
        placeholder="—"
        className="w-24 px-2 py-1 text-sm rounded-lg focus:outline-none text-right"
        style={{
          background: `${tw}0.05)`,
          border: `1px solid ${borderColor}`,
          color: 'white',
          transition: 'border-color 0.2s',
        }}
      />
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: '#F5B800' }} />}
      {state === 'saved'  && <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#34d399' }} />}
      {state === 'error'  && <span className="text-[10px]" style={{ color: '#f87171' }}>Error</span>}
    </div>
  )
}

export default function PlanillaTable() {
  const hoyBog = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha,     setFecha]     = useState(hoyBog)
  const [doms,      setDoms]      = useState<Dom[]>([])
  const [paquetes,  setPaquetes]  = useState<Paq[]>([])
  const [manuales,  setManuales]  = useState<Man[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [lastSync,  setLastSync]  = useState<Date | null>(null)

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/admin/domiciliarios/planilla?fecha=${fecha}`)
      const data = await res.json() as { domiciliarios?: Dom[]; paquetes?: Paq[]; manuales?: Man[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar')
      setDoms(data.domiciliarios ?? [])
      setPaquetes(data.paquetes   ?? [])
      setManuales(data.manuales   ?? [])
      setLastSync(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [fecha])

  // Carga inicial y al cambiar fecha
  useEffect(() => { cargar() }, [cargar])

  // Auto-refresh cada 30 s
  useEffect(() => {
    const t = setInterval(() => cargar(true), 30_000)
    return () => clearInterval(t)
  }, [cargar])

  async function guardarValor(tipo: 'paquete' | 'manual', id: string, valor: number | null) {
    const res = await fetch('/api/admin/domiciliarios/planilla', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, valor }),
    })
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      throw new Error(d.error ?? 'Error al guardar')
    }
    // Actualizar estado local
    if (tipo === 'paquete') {
      setPaquetes(prev => prev.map(p => p.id === id ? { ...p, valor_domicilio: valor } : p))
    } else {
      setManuales(prev => prev.map(m => m.id === id ? { ...m, valor: valor } : m))
    }
  }

  const total = paquetes.length + manuales.length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${tw}0.1)`, background: `${tw}0.04)` }}>
          <Calendar className="h-3.5 w-3.5 ml-3 flex-shrink-0" style={{ color: `${tw}0.35)` }} />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            max={hoyBog}
            className="px-2 py-2 text-xs bg-transparent focus:outline-none"
            style={{ color: `${tw}0.7)`, colorScheme: 'dark' }}
          />
        </div>
        <button
          onClick={() => cargar()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
          style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
        {lastSync && (
          <span className="text-[11px]" style={{ color: `${tw}0.25)` }}>
            Última sync: {lastSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 text-sm" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#34d399' }} />
          <span className="text-sm" style={{ color: `${tw}0.4)` }}>Cargando planilla…</span>
        </div>
      ) : total === 0 ? (
        <div className="glass-card p-12 text-center">
          <p style={{ color: `${tw}0.4)` }}>Sin entregas para esta fecha</p>
        </div>
      ) : (
        <div className="space-y-6">
          {doms.map(dom => {
            const domPaq = paquetes.filter(p => p.domiciliario_id === dom.id)
            const domMan = manuales.filter(m => m.domiciliario_id === dom.id)
            const subtotal =
              domPaq.reduce((s, p) => s + (p.valor_domicilio ?? 0), 0) +
              domMan.reduce((s, m) => s + (m.valor ?? 0), 0)
            if (!domPaq.length && !domMan.length) return null

            return (
              <div key={dom.id} className="glass-card overflow-hidden">
                {/* Header domiciliario */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${tw}0.07)`, background: 'rgba(129,140,248,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
                      {dom.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-sm text-white">{dom.nombre_completo}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: `${tw}0.06)`, color: `${tw}0.4)` }}>
                      {domPaq.length + domMan.length} entregas
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: `${tw}0.35)` }}>Total</p>
                    <p className="text-sm font-bold" style={{ color: subtotal > 0 ? '#34d399' : `${tw}0.3)` }}>
                      {subtotal > 0 ? `$${subtotal.toLocaleString('es-CO')}` : '—'}
                    </p>
                  </div>
                </div>

                {/* Tabla */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${tw}0.06)` }}>
                        {['Tipo', 'Nombre / Tracking', 'Dirección', 'Hora', 'Valor'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                            style={{ color: `${tw}0.3)` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Paquetes */}
                      {domPaq.map(p => (
                        <tr key={`p-${p.id}`} style={{ borderBottom: `1px solid ${tw}0.04)` }}>
                          <td className="px-4 py-2.5">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: TIPO_COLORS.paquete.bg, color: TIPO_COLORS.paquete.color }}>
                              <Package className="h-3 w-3 inline mr-1" />Paquete
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-mono text-xs font-bold" style={{ color: '#F5B800' }}>
                              {p.tracking_origen ?? p.tracking_casilla}
                            </p>
                            {p.cliente_nombre && (
                              <p className="text-[11px]" style={{ color: `${tw}0.4)` }}>{p.cliente_nombre}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: `${tw}0.45)` }}>—</td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: `${tw}0.4)` }}>
                            {horaCorta(p.updated_at)}
                          </td>
                          <td className="px-4 py-2.5">
                            <ValorCell tipo="paquete" id={p.id} inicial={p.valor_domicilio} onSave={guardarValor} />
                          </td>
                        </tr>
                      ))}
                      {/* Manuales */}
                      {domMan.map(m => {
                        const tc = TIPO_COLORS[m.tipo] ?? TIPO_COLORS.productos
                        return (
                          <tr key={`m-${m.id}`} style={{ borderBottom: `1px solid ${tw}0.04)` }}>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: tc.bg, color: tc.color }}>
                                <FileText className="h-3 w-3 inline mr-1" />
                                {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-medium text-white">{m.nombre}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs" style={{ color: `${tw}0.45)`, maxWidth: 180 }}>
                              <span className="line-clamp-1">{m.direccion ?? '—'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: `${tw}0.4)` }}>
                              {horaCorta(m.completado_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              <ValorCell tipo="manual" id={m.id} inicial={m.valor} onSave={guardarValor} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Subtotal row */}
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${tw}0.08)`, background: `${tw}0.02)` }}>
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-right"
                          style={{ color: `${tw}0.4)` }}>Subtotal {dom.nombre_completo}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-bold" style={{ color: subtotal > 0 ? '#34d399' : `${tw}0.3)` }}>
                            {subtotal > 0 ? `$${subtotal.toLocaleString('es-CO')}` : '—'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Gran total */}
          {(() => {
            const gran = paquetes.reduce((s, p) => s + (p.valor_domicilio ?? 0), 0) +
                         manuales.reduce((s, m) => s + (m.valor ?? 0), 0)
            return (
              <div className="glass-card px-5 py-4 flex items-center justify-between"
                style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
                <div>
                  <p className="text-xs" style={{ color: `${tw}0.4)` }}>Total del día</p>
                  <p className="text-sm" style={{ color: `${tw}0.3)` }}>{total} entregas</p>
                </div>
                <p className="text-2xl font-bold" style={{ color: gran > 0 ? '#34d399' : `${tw}0.25)` }}>
                  {gran > 0 ? `$${gran.toLocaleString('es-CO')}` : '—'}
                </p>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
