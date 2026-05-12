'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  GripVertical, Sparkles, Loader2, MapPin, CheckCircle2,
  Package, FileText, Pencil, X, Check, Trash2, Phone,
} from 'lucide-react'

const tw = 'rgba(255,255,255,'

const RutaMapa = dynamic(() => import('./RutaMapaInner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl flex items-center justify-center gap-2"
      style={{ height: 340, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs" style={{ color: `${tw}0.3)` }}>Cargando mapa...</span>
    </div>
  ),
})

export interface ParadaRuta {
  tipo: 'paquete' | 'manual'
  id: string
  label: string
  descripcion: string
  direccion: string | null
  telefono: string | null
  notas: string | null
  ordenActual: number
}

interface EditManual {
  nombre: string
  direccion: string
  telefono: string
  notas: string
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

  // Optimizar / guardar
  const [optimizando, setOptimizando] = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')
  const [flash,       setFlash]       = useState('')

  // Edición de dirección en paquetes
  const [editandoDir,  setEditandoDir]  = useState<string | null>(null)
  const [dirTemp,      setDirTemp]      = useState('')
  const [guardandoDir, setGuardandoDir] = useState(false)

  // Edición completa de domicilio manual
  const [editandoManual,  setEditandoManual]  = useState<string | null>(null)
  const [editForm,        setEditForm]        = useState<EditManual>({ nombre: '', direccion: '', telefono: '', notas: '' })
  const [guardandoManual, setGuardandoManual] = useState(false)

  // Eliminación de domicilio manual
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null)
  const [borrando,          setBorrando]          = useState(false)

  // Drag
  const dragIdx = useRef<number | null>(null)
  const overIdx = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over,     setOver]     = useState<number | null>(null)

  const paradasMapa = lista
    .filter(p => p.direccion)
    .map(p => ({ num: lista.indexOf(p) + 1, label: p.label, direccion: p.direccion!, tipo: p.tipo }))

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
        body: JSON.stringify({ items: items.map((p, i) => ({ tipo: p.tipo, id: p.id, orden: i })) }),
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
        const idxMap = new Map(lista.map(p => [`${p.tipo}:${p.id}`, p]))
        const reordenada = data.orden.map(k => idxMap.get(k)).filter(Boolean) as ParadaRuta[]
        const vistos = new Set(data.orden)
        lista.forEach(p => { if (!vistos.has(`${p.tipo}:${p.id}`)) reordenada.push(p) })
        setLista(reordenada)
        setFlash('¡Ruta optimizada con IA!')
        setTimeout(() => setFlash(''), 3500)
      }
    } catch { setError('Error de conexión') }
    finally { setOptimizando(false) }
  }

  // ── Dirección de paquete ─────────────────────────────────────────
  async function guardarDireccionPaquete(paqueteId: string) {
    if (!dirTemp.trim()) { setEditandoDir(null); return }
    setGuardandoDir(true)
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/direccion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion_entrega: dirTemp.trim() }),
      })
      if (res.ok) {
        setLista(prev => prev.map(p => p.id === paqueteId ? { ...p, direccion: dirTemp.trim() } : p))
        setEditandoDir(null)
      } else setError('Error al guardar dirección')
    } catch { setError('Error de conexión') }
    finally { setGuardandoDir(false) }
  }

  // ── Editar domicilio manual ──────────────────────────────────────
  function abrirEdicionManual(parada: ParadaRuta) {
    setEditandoManual(parada.id)
    setEditForm({
      nombre:    parada.label,
      direccion: parada.direccion ?? '',
      telefono:  parada.telefono  ?? '',
      notas:     parada.notas     ?? '',
    })
    setConfirmandoBorrar(null)
  }

  async function guardarManual(id: string) {
    if (!editForm.nombre.trim() || !editForm.direccion.trim()) return
    setGuardandoManual(true); setError('')
    try {
      const res = await fetch(`/api/admin/domicilios-manuales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:    editForm.nombre.trim(),
          direccion: editForm.direccion.trim(),
          telefono:  editForm.telefono.trim()  || null,
          notas:     editForm.notas.trim()     || null,
        }),
      })
      if (res.ok) {
        setLista(prev => prev.map(p => p.id === id ? {
          ...p,
          label:     editForm.nombre.trim(),
          direccion: editForm.direccion.trim(),
          telefono:  editForm.telefono.trim()  || null,
          notas:     editForm.notas.trim()     || null,
        } : p))
        setEditandoManual(null)
        router.refresh()
      } else setError('Error al guardar')
    } catch { setError('Error de conexión') }
    finally { setGuardandoManual(false) }
  }

  // ── Eliminar domicilio manual ────────────────────────────────────
  async function eliminarManual(id: string) {
    setBorrando(true); setError('')
    try {
      const res = await fetch(`/api/admin/domicilios-manuales/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLista(prev => prev.filter(p => p.id !== id))
        setConfirmandoBorrar(null)
        router.refresh()
      } else setError('Error al eliminar')
    } catch { setError('Error de conexión') }
    finally { setBorrando(false) }
  }

  // ── Render ───────────────────────────────────────────────────────
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
          style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}
        >
          {optimizando
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Optimizando...</>
            : <><Sparkles className="h-3.5 w-3.5" />Optimizar con IA</>}
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
          <CheckCircle2 className="h-3.5 w-3.5" />{flash}
        </div>
      )}
      {error && (
        <p className="text-xs px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      {/* Lista */}
      <div className="space-y-1.5">
        {lista.map((parada, idx) => {
          const isDragging = dragging === idx
          const isOver     = over === idx && dragging !== idx
          const sinDir     = !parada.direccion
          const esManual   = parada.tipo === 'manual'
          const editandoDirEste   = editandoDir    === parada.id
          const editandoManualEste = editandoManual === parada.id
          const confirmandoEste   = confirmandoBorrar === parada.id

          return (
            <div
              key={`${parada.tipo}-${parada.id}`}
              className="rounded-xl transition-all"
              style={{
                background: isDragging ? 'rgba(129,140,248,0.18)'
                  : isOver ? 'rgba(129,140,248,0.08)'
                  : confirmandoEste ? 'rgba(239,68,68,0.06)'
                  : 'rgba(255,255,255,0.03)',
                border: isOver ? '1px solid rgba(129,140,248,0.4)'
                  : confirmandoEste ? '1px solid rgba(239,68,68,0.25)'
                  : sinDir && !editandoManualEste ? '1px dashed rgba(245,184,0,0.3)'
                  : '1px solid rgba(255,255,255,0.07)',
                opacity: isDragging ? 0.55 : 1,
                transform: isOver ? 'translateY(-1px)' : undefined,
              }}
            >
              {/* ── Vista normal / confirmación borrado ── */}
              {!editandoManualEste && (
                <div
                  draggable={!editandoDirEste && !confirmandoEste}
                  onDragStart={() => onDragStart(idx)}
                  onDragEnter={() => onDragEnter(idx)}
                  onDragEnd={onDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className="flex items-start gap-2 px-3 py-2.5"
                  style={{ cursor: editandoDirEste || confirmandoEste ? 'default' : 'grab' }}
                >
                  {/* Handle + número */}
                  <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                    <GripVertical className="h-3.5 w-3.5" style={{ color: `${tw}0.18)` }} />
                    <span className="text-[11px] font-bold w-5 text-center"
                      style={{ color: esManual ? '#818cf8' : '#F5B800' }}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Icono */}
                  <div className="flex-shrink-0 pt-0.5">
                    {esManual
                      ? <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                      : <Package  className="h-3.5 w-3.5" style={{ color: '#F5B800' }} />}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-bold text-white truncate">{parada.label}</p>
                    {parada.descripcion && parada.descripcion !== parada.label && (
                      <p className="text-[11px] truncate" style={{ color: `${tw}0.4)` }}>{parada.descripcion}</p>
                    )}

                    {/* Dirección */}
                    {editandoDirEste ? (
                      <div className="flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={dirTemp}
                          onChange={e => setDirTemp(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') guardarDireccionPaquete(parada.id)
                            if (e.key === 'Escape') setEditandoDir(null)
                          }}
                          placeholder="Ej: Calle 50 #40-10, El Poblado"
                          className="flex-1 text-xs px-2 py-1 rounded-lg focus:outline-none"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(245,184,0,0.4)', color: 'white' }}
                        />
                        <button onClick={() => guardarDireccionPaquete(parada.id)} disabled={guardandoDir || !dirTemp.trim()} style={{ color: '#34d399' }}>
                          {guardandoDir ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setEditandoDir(null)} style={{ color: `${tw}0.4)` }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : parada.direccion ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.25)` }} />
                        <span className="text-[11px] truncate" style={{ color: `${tw}0.45)` }}>{parada.direccion}</span>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setEditandoDir(parada.id); setDirTemp('') }}
                        className="flex items-center gap-1 text-[11px] font-medium"
                        style={{ color: '#F5B800' }}
                      >
                        <Pencil className="h-3 w-3" />Agregar dirección
                      </button>
                    )}

                    {parada.telefono && !editandoDirEste && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-2.5 w-2.5 flex-shrink-0" style={{ color: `${tw}0.2)` }} />
                        <span className="text-[10px]" style={{ color: `${tw}0.35)` }}>{parada.telefono}</span>
                      </div>
                    )}
                    {parada.notas && !editandoDirEste && (
                      <p className="text-[10px] truncate" style={{ color: `${tw}0.28)` }}>{parada.notas}</p>
                    )}

                    {/* Confirmación de borrado inline */}
                    {confirmandoEste && (
                      <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                        <span className="text-xs" style={{ color: '#f87171' }}>¿Eliminar este domicilio?</span>
                        <button
                          onClick={() => eliminarManual(parada.id)}
                          disabled={borrando}
                          className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          {borrando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí, eliminar'}
                        </button>
                        <button
                          onClick={() => setConfirmandoBorrar(null)}
                          className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ color: `${tw}0.4)`, border: `1px solid ${tw}0.1)` }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Acciones — solo para domicilios manuales */}
                  {esManual && !editandoDirEste && !confirmandoEste && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => abrirEdicionManual(parada)}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Editar"
                        style={{ color: `${tw}0.3)` }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                        onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.3)`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setConfirmandoBorrar(parada.id); setEditandoManual(null) }}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Eliminar"
                        style={{ color: `${tw}0.3)` }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.3)`)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Formulario de edición inline ── */}
              {editandoManualEste && (
                <div className="p-4 space-y-2.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#818cf8' }} />
                    <p className="text-xs font-bold" style={{ color: '#818cf8' }}>Editar domicilio</p>
                    <button onClick={() => setEditandoManual(null)} className="ml-auto" style={{ color: `${tw}0.35)` }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {[
                    { key: 'nombre',    label: 'Nombre',     placeholder: 'Destinatario',          required: true  },
                    { key: 'direccion', label: 'Dirección',  placeholder: 'Calle, carrera, barrio', required: true  },
                    { key: 'telefono',  label: 'Teléfono',   placeholder: 'WhatsApp o celular',     required: false },
                    { key: 'notas',     label: 'Notas',      placeholder: 'Instrucciones...',       required: false },
                  ].map(({ key, label, placeholder, required }) => (
                    <div key={key}>
                      <label className="text-[11px] mb-1 block" style={{ color: `${tw}0.4)` }}>
                        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
                      </label>
                      <input
                        type="text"
                        value={editForm[key as keyof EditManual]}
                        onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 text-xs rounded-xl focus:outline-none"
                        style={{ background: `${tw}0.06)`, border: `1px solid ${tw}0.1)`, color: 'white' }}
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditandoManual(null)}
                      className="flex-1 py-2 rounded-xl text-xs font-medium"
                      style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => guardarManual(parada.id)}
                      disabled={guardandoManual || !editForm.nombre.trim() || !editForm.direccion.trim()}
                      className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}
                    >
                      {guardandoManual ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando...</> : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}
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
