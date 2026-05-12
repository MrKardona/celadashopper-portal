'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { GripVertical, Sparkles, Loader2, MapPin, CheckCircle2, Package, FileText, Pencil, X, Check } from 'lucide-react'

const tw = 'rgba(255,255,255,'

// Mapa cargado solo en cliente (Leaflet no soporta SSR)
const RutaMapa = dynamic(() => import('./RutaMapaInner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl flex items-center justify-center gap-2" style={{ height: 340, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs" style={{ color: `${tw}0.3)` }}>Cargando mapa...</span>
    </div>
  ),
})

export interface ParadaRuta {
  tipo: 'paquete' | 'manual'
  id: string
  label: string        // tracking o nombre
  descripcion: string  // descripcion del paquete o dirección corta
  direccion: string | null
  telefono: string | null
  notas: string | null
  ordenActual: number
}

interface Props {
  domiciliarioId: string
  paradas: ParadaRuta[]
}

export default function OrdenarRutaPanel({ domiciliarioId, paradas: inicial }: Props) {
  const router = useRouter()
  const [lista, setLista] = useState<ParadaRuta[]>(() =>
    [...inicial].sort((a, b) => a.ordenActual - b.ordenActual)
  )
  const [optimizando,  setOptimizando]  = useState(false)
  const [guardando,    setGuardando]    = useState(false)
  const [error,        setError]        = useState('')
  const [flash,        setFlash]        = useState('')
  const [editandoDir,  setEditandoDir]  = useState<string | null>(null)  // id del paquete siendo editado
  const [dirTemp,      setDirTemp]      = useState('')
  const [guardandoDir, setGuardandoDir] = useState(false)

  // Drag state
  const dragIdx  = useRef<number | null>(null)
  const overIdx  = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over,     setOver]     = useState<number | null>(null)

  // Paradas con dirección para el mapa (en orden actual)
  const paradasMapa = lista
    .filter(p => p.direccion)
    .map((p, _, arr) => ({
      num: lista.indexOf(p) + 1,
      label: p.label,
      direccion: p.direccion!,
      tipo: p.tipo,
    }))

  if (lista.length === 0) return null

  // ── Drag ────────────────────────────────────────────────────────
  function onDragStart(idx: number) { dragIdx.current = idx; setDragging(idx) }
  function onDragEnter(idx: number) { overIdx.current = idx; setOver(idx) }
  function onDragEnd() {
    const from = dragIdx.current; const to = overIdx.current
    dragIdx.current = null; overIdx.current = null
    setDragging(null); setOver(null)
    if (from === null || to === null || from === to) return
    const next = [...lista]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLista(next)
    guardarOrden(next)
  }

  // ── Guardar orden ────────────────────────────────────────────────
  async function guardarOrden(items: ParadaRuta[]) {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/admin/ruta/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((p, i) => ({ tipo: p.tipo, id: p.id, orden: i })),
        }),
      })
      if (!res.ok) setError('Error al guardar el orden')
      else router.refresh()
    } catch { setError('Error de conexión') }
    finally { setGuardando(false) }
  }

  // ── Optimizar con IA ─────────────────────────────────────────────
  async function optimizar() {
    setOptimizando(true); setError(''); setFlash('')
    try {
      const res = await fetch('/api/admin/ruta/optimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domiciliario_id: domiciliarioId }),
      })
      const data = await res.json() as { ok?: boolean; orden?: string[]; message?: string; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al optimizar'); return }
      if (data.message) { setFlash(data.message); return }
      if (data.orden) {
        // data.orden = ['paquete:uuid', 'manual:uuid', ...]
        const idxMap = new Map(lista.map(p => [`${p.tipo}:${p.id}`, p]))
        const reordenada = data.orden.map(k => idxMap.get(k)).filter(Boolean) as ParadaRuta[]
        // Incluir items que no llegaron en la respuesta (inesperado)
        const vistos = new Set(data.orden)
        lista.forEach(p => { if (!vistos.has(`${p.tipo}:${p.id}`)) reordenada.push(p) })
        setLista(reordenada)
        setFlash('¡Ruta optimizada con IA!')
        setTimeout(() => setFlash(''), 3500)
      }
    } catch { setError('Error de conexión') }
    finally { setOptimizando(false) }
  }

  // ── Guardar dirección de paquete ─────────────────────────────────
  async function guardarDireccion(paqueteId: string) {
    if (!dirTemp.trim()) { setEditandoDir(null); return }
    setGuardandoDir(true)
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/direccion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion_entrega: dirTemp.trim() }),
      })
      if (res.ok) {
        setLista(prev => prev.map(p =>
          p.id === paqueteId ? { ...p, direccion: dirTemp.trim() } : p
        ))
        setEditandoDir(null)
      } else setError('Error al guardar dirección')
    } catch { setError('Error de conexión') }
    finally { setGuardandoDir(false) }
  }

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>
          Ruta · {lista.length} paradas
        </p>
        <button
          onClick={optimizar}
          disabled={optimizando || lista.length < 2}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}
        >
          {optimizando
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Optimizando con IA...</>
            : <><Sparkles className="h-3.5 w-3.5" />Optimizar con IA</>}
        </button>
      </div>

      {/* Flash / error */}
      {flash && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
          <CheckCircle2 className="h-3.5 w-3.5" />{flash}
        </div>
      )}
      {error && (
        <p className="text-xs px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      {/* Lista draggable */}
      <div className="space-y-1.5">
        {lista.map((parada, idx) => {
          const isDragging = dragging === idx
          const isOver     = over === idx && dragging !== idx
          const sinDir     = !parada.direccion
          const editando   = editandoDir === parada.id

          return (
            <div
              key={`${parada.tipo}-${parada.id}`}
              draggable={!editando}
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className="rounded-xl transition-all select-none"
              style={{
                background: isDragging ? 'rgba(129,140,248,0.2)' : isOver ? 'rgba(129,140,248,0.1)' : 'rgba(255,255,255,0.03)',
                border: isOver ? '1px solid rgba(129,140,248,0.4)' : sinDir ? '1px dashed rgba(245,184,0,0.3)' : '1px solid rgba(255,255,255,0.07)',
                opacity: isDragging ? 0.55 : 1,
                transform: isOver ? 'translateY(-1px)' : undefined,
                cursor: editando ? 'default' : 'grab',
              }}
            >
              <div className="flex items-start gap-2 px-3 py-2.5">
                {/* Handle + número */}
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  <GripVertical className="h-3.5 w-3.5" style={{ color: `${tw}0.18)` }} />
                  <span className="text-[11px] font-bold w-5 text-center"
                    style={{ color: parada.tipo === 'paquete' ? '#F5B800' : '#818cf8' }}>
                    {idx + 1}
                  </span>
                </div>

                {/* Icono tipo */}
                <div className="flex-shrink-0 pt-0.5">
                  {parada.tipo === 'paquete'
                    ? <Package className="h-3.5 w-3.5" style={{ color: '#F5B800' }} />
                    : <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-bold text-white truncate">{parada.label}</p>
                  {parada.descripcion && parada.descripcion !== parada.label && (
                    <p className="text-[11px] truncate" style={{ color: `${tw}0.4)` }}>{parada.descripcion}</p>
                  )}

                  {/* Dirección */}
                  {editando ? (
                    <div className="flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={dirTemp}
                        onChange={e => setDirTemp(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') guardarDireccion(parada.id)
                          if (e.key === 'Escape') setEditandoDir(null)
                        }}
                        placeholder="Ej: Calle 50 #40-10, El Poblado"
                        className="flex-1 text-xs px-2 py-1 rounded-lg focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(245,184,0,0.4)', color: 'white' }}
                      />
                      <button
                        onClick={() => guardarDireccion(parada.id)}
                        disabled={guardandoDir || !dirTemp.trim()}
                        className="p-1 rounded-lg disabled:opacity-40"
                        style={{ color: '#34d399' }}
                      >
                        {guardandoDir ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setEditandoDir(null)} className="p-1 rounded-lg" style={{ color: `${tw}0.4)` }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {parada.direccion ? (
                        <>
                          <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: `${tw}0.25)` }} />
                          <span className="text-[11px] truncate" style={{ color: `${tw}0.45)` }}>{parada.direccion}</span>
                          {parada.tipo === 'paquete' && (
                            <button
                              onClick={e => { e.stopPropagation(); setEditandoDir(parada.id); setDirTemp(parada.direccion ?? '') }}
                              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: `${tw}0.3)` }}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setEditandoDir(parada.id); setDirTemp('') }}
                          className="flex items-center gap-1 text-[11px] font-medium hover:opacity-80 transition-opacity"
                          style={{ color: '#F5B800' }}
                        >
                          <Pencil className="h-3 w-3" />
                          Agregar dirección
                        </button>
                      )}
                    </div>
                  )}

                  {parada.notas && !editando && (
                    <p className="text-[10px] truncate" style={{ color: `${tw}0.28)` }}>{parada.notas}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {guardando && (
        <p className="text-[10px] flex items-center gap-1.5" style={{ color: `${tw}0.3)` }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Guardando orden...
        </p>
      )}

      {/* Mapa */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <RutaMapa paradas={paradasMapa} />
      </div>
    </div>
  )
}
