'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, RefreshCw, CheckCircle2, Loader2, FileText, Package, Pencil, X, Download, ChevronRight } from 'lucide-react'

const tw = 'rgba(255,255,255,'

const TIPO_COLORS: Record<string, { color: string; bg: string }> = {
  personal:  { color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  servicios: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  productos: { color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  paquete:   { color: '#F5B800', bg: 'rgba(245,184,0,0.10)'   },
}

const TIPO_OPCIONES = ['personal', 'servicios', 'productos']

type Dom  = { id: string; nombre_completo: string }
type Paq  = { id: string; tracking_casilla: string | null; tracking_origen: string | null; descripcion: string | null; cliente_nombre: string; domiciliario_id: string; updated_at: string; valor_domicilio: number | null }
type Man  = { id: string; nombre: string; direccion: string | null; tipo: string; domiciliario_id: string; completado_at: string; valor: number | null }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true })
}

// ── Celda editable de valor ────────────────────────────────────────────────
function ValorCell({ tipo, id, inicial, onSave }: {
  tipo: 'paquete' | 'manual'
  id: string
  inicial: number | null
  onSave: (tipo: 'paquete' | 'manual', id: string, valor: number | null) => Promise<void>
}) {
  const [val,   setVal]   = useState(inicial !== null ? String(inicial) : '')
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        style={{ background: `${tw}0.05)`, border: `1px solid ${borderColor}`, color: 'white', transition: 'border-color 0.2s' }}
      />
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: '#F5B800' }} />}
      {state === 'saved'  && <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: '#34d399' }} />}
      {state === 'error'  && <span className="text-[10px]" style={{ color: '#f87171' }}>Error</span>}
    </div>
  )
}

// ── Fila de edición de domicilio manual ───────────────────────────────────
function EditManualRow({ m, onCancel, onSaved }: {
  m: Man
  onCancel: () => void
  onSaved: (updated: Partial<Man>) => void
}) {
  const [nombre,    setNombre]    = useState(m.nombre)
  const [direccion, setDireccion] = useState(m.direccion ?? '')
  const [tipo,      setTipo]      = useState(m.tipo)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  async function save() {
    if (!nombre.trim()) return
    setSaving(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/domiciliarios/planilla', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'manual',
          id:   m.id,
          campos: {
            nombre:    nombre.trim(),
            direccion: direccion.trim() || null,
            tipo,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Error al guardar')
      }
      onSaved({ nombre: nombre.trim(), direccion: direccion.trim() || null, tipo })
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: `${tw}0.07)`,
    border: `1px solid ${tw}0.15)`,
    color: 'white',
    outline: 'none',
  }

  return (
    <tr style={{ background: 'rgba(245,184,0,0.04)', borderBottom: `1px solid ${tw}0.06)` }}>
      {/* Tipo */}
      <td className="px-4 py-3">
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          className="glass-input text-xs py-1.5 w-full"
        >
          {TIPO_OPCIONES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </td>
      {/* Nombre */}
      <td className="px-4 py-3">
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
          className="w-full px-2 py-1.5 text-xs rounded-lg"
          style={inputStyle}
          placeholder="Nombre"
          autoFocus
        />
      </td>
      {/* Dirección */}
      <td className="px-4 py-3">
        <input
          value={direccion}
          onChange={e => setDireccion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
          className="w-full px-2 py-1.5 text-xs rounded-lg"
          style={inputStyle}
          placeholder="Dirección (opcional)"
        />
      </td>
      {/* Hora (read-only) */}
      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: `${tw}0.4)` }}>
        {horaCorta(m.completado_at)}
      </td>
      {/* Valor (read-only en modo edit — se edita en la fila normal) */}
      <td className="px-4 py-2.5 text-xs" style={{ color: `${tw}0.3)` }}>
        {m.valor !== null ? `$${m.valor.toLocaleString('es-CO')}` : '—'}
      </td>
      {/* Acciones */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={save}
            disabled={saving || !nombre.trim()}
            className="px-2.5 py-1 text-xs rounded-lg font-semibold disabled:opacity-40 whitespace-nowrap"
            style={{ background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
          </button>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg"
            style={{ color: `${tw}0.35)` }}
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {err && <span className="text-[10px]" style={{ color: '#f87171' }}>{err}</span>}
        </div>
      </td>
    </tr>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function PlanillaTable() {
  const hoyBog = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const [fechaDesde,  setFechaDesde]  = useState(hoyBog)
  const [fechaHasta,  setFechaHasta]  = useState(hoyBog)
  const [doms,        setDoms]        = useState<Dom[]>([])
  const [paquetes,    setPaquetes]    = useState<Paq[]>([])
  const [manuales,    setManuales]    = useState<Man[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [lastSync,    setLastSync]    = useState<Date | null>(null)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)

  const esRango = fechaDesde !== fechaHasta

  const rangoLabel = esRango
    ? `${new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} — ${new Date(fechaHasta + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    setError('')
    try {
      const url = esRango
        ? `/api/admin/domiciliarios/planilla?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`
        : `/api/admin/domiciliarios/planilla?fecha=${fechaDesde}`
      const res  = await fetch(url)
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
  }, [fechaDesde, fechaHasta, esRango])

  useEffect(() => { cargar() }, [cargar])

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
    if (tipo === 'paquete') {
      setPaquetes(prev => prev.map(p => p.id === id ? { ...p, valor_domicilio: valor } : p))
    } else {
      setManuales(prev => prev.map(m => m.id === id ? { ...m, valor } : m))
    }
  }

  async function descargarExcel() {
    setDescargando(true)
    try {
      const url = esRango
        ? `/api/admin/domiciliarios/informe-excel?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}`
        : `/api/admin/domiciliarios/informe-excel?fecha=${fechaDesde}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al generar informe')
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = esRango
        ? `informe-domicilios-${fechaDesde}-a-${fechaHasta}.xlsx`
        : `informe-domicilios-${fechaDesde}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setDescargando(false)
    }
  }

  const total = paquetes.length + manuales.length

  return (
    <div className="space-y-4">

      {/* ── Controles ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Fecha desde */}
        <div className="flex items-center gap-1 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${tw}0.1)`, background: `${tw}0.04)` }}>
          <Calendar className="h-3.5 w-3.5 ml-3 flex-shrink-0" style={{ color: `${tw}0.35)` }} />
          <span className="text-[10px] pl-1 pr-0.5" style={{ color: `${tw}0.3)` }}>Desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => {
              setFechaDesde(e.target.value)
              if (e.target.value > fechaHasta) setFechaHasta(e.target.value)
            }}
            max={hoyBog}
            className="px-2 py-2 text-xs bg-transparent focus:outline-none"
            style={{ color: `${tw}0.7)`, colorScheme: 'dark' }}
          />
        </div>

        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.2)` }} />

        {/* Fecha hasta */}
        <div className="flex items-center gap-1 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${tw}0.1)`, background: `${tw}0.04)` }}>
          <span className="text-[10px] pl-3 pr-0.5" style={{ color: `${tw}0.3)` }}>Hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            min={fechaDesde}
            max={hoyBog}
            className="px-2 py-2 text-xs bg-transparent focus:outline-none"
            style={{ color: `${tw}0.7)`, colorScheme: 'dark' }}
          />
        </div>

        {/* Botón hoy */}
        {(fechaDesde !== hoyBog || fechaHasta !== hoyBog) && (
          <button
            onClick={() => { setFechaDesde(hoyBog); setFechaHasta(hoyBog) }}
            className="px-2.5 py-2 rounded-xl text-xs transition-all"
            style={{ border: `1px solid ${tw}0.08)`, color: `${tw}0.35)` }}
          >
            Hoy
          </button>
        )}

        <button
          onClick={() => cargar()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
          style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>

        <button
          onClick={descargarExcel}
          disabled={descargando || loading || total === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'rgba(245,184,0,0.1)', border: '1px solid rgba(245,184,0,0.25)', color: '#F5B800' }}
        >
          {descargando
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
          Informe Excel
        </button>

        {lastSync && (
          <span className="text-[11px] ml-auto" style={{ color: `${tw}0.22)` }}>
            Sync {lastSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
        )}
      </div>

      {/* Rango activo */}
      {!loading && (
        <p className="text-xs capitalize" style={{ color: `${tw}0.32)` }}>
          {rangoLabel}
          {total > 0 && (
            <span style={{ color: `${tw}0.45)` }}> · {total} entrega{total !== 1 ? 's' : ''}</span>
          )}
        </p>
      )}

      {error && (
        <div className="glass-card p-4 text-sm" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* ── Contenido ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#34d399' }} />
          <span className="text-sm" style={{ color: `${tw}0.4)` }}>Cargando planilla…</span>
        </div>
      ) : total === 0 ? (
        <div className="glass-card p-12 text-center">
          <p style={{ color: `${tw}0.4)` }}>Sin entregas para este período</p>
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
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {/* Paquetes */}
                      {domPaq.map(p => (
                        <tr key={`p-${p.id}`} style={{ borderBottom: `1px solid ${tw}0.04)` }}>
                          <td className="px-4 py-2.5">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
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
                          <td />
                        </tr>
                      ))}

                      {/* Manuales */}
                      {domMan.map(m => {
                        const tc = TIPO_COLORS[m.tipo] ?? TIPO_COLORS.productos
                        if (editingId === m.id) {
                          return (
                            <EditManualRow
                              key={`m-${m.id}-edit`}
                              m={m}
                              onCancel={() => setEditingId(null)}
                              onSaved={updated => {
                                setManuales(prev => prev.map(x => x.id === m.id ? { ...x, ...updated } : x))
                                setEditingId(null)
                              }}
                            />
                          )
                        }
                        return (
                          <tr key={`m-${m.id}`} className="group" style={{ borderBottom: `1px solid ${tw}0.04)` }}>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
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
                            <td className="px-2 py-2.5">
                              <button
                                onClick={() => setEditingId(m.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity"
                                style={{ color: `${tw}0.35)` }}
                                title="Editar domicilio"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>

                    {/* Subtotal */}
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${tw}0.08)`, background: `${tw}0.02)` }}>
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-right"
                          style={{ color: `${tw}0.4)` }}>
                          Subtotal {dom.nombre_completo}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-sm font-bold" style={{ color: subtotal > 0 ? '#34d399' : `${tw}0.3)` }}>
                            {subtotal > 0 ? `$${subtotal.toLocaleString('es-CO')}` : '—'}
                          </span>
                        </td>
                        <td />
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
                  <p className="text-xs" style={{ color: `${tw}0.4)` }}>
                    Total {esRango ? 'del período' : 'del día'}
                  </p>
                  <p className="text-sm" style={{ color: `${tw}0.3)` }}>{total} entrega{total !== 1 ? 's' : ''}</p>
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
