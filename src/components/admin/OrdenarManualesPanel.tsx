'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, Sparkles, Loader2, MapPin, CheckCircle2, Phone, FileText } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Manual {
  id: string
  nombre: string
  direccion: string
  telefono: string | null
  notas: string | null
}

interface Props {
  domiciliarioId: string
  manuales: Manual[]
}

export default function OrdenarManualesPanel({ domiciliarioId, manuales: inicial }: Props) {
  const router = useRouter()
  const [lista, setLista] = useState<Manual[]>(inicial)
  const [optimizando, setOptimizando] = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')
  const [flash,       setFlash]       = useState('')

  // Drag state
  const dragIdx   = useRef<number | null>(null)
  const dragOver  = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over,     setOver]     = useState<number | null>(null)

  if (lista.length === 0) return null

  // ── Drag handlers ─────────────────────────────────────────────
  function onDragStart(idx: number) {
    dragIdx.current = idx
    setDragging(idx)
  }

  function onDragEnter(idx: number) {
    dragOver.current = idx
    setOver(idx)
  }

  function onDragEnd() {
    const from = dragIdx.current
    const to   = dragOver.current
    dragIdx.current  = null
    dragOver.current = null
    setDragging(null)
    setOver(null)

    if (from === null || to === null || from === to) return

    const next = [...lista]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLista(next)
    guardarOrden(next)
  }

  // ── Guardar orden ──────────────────────────────────────────────
  async function guardarOrden(items: Manual[]) {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/admin/domicilios-manuales/reordenar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((m, i) => ({ id: m.id, orden: i })) }),
      })
      if (!res.ok) { setError('Error al guardar el orden'); return }
      router.refresh()
    } catch { setError('Error de conexión') }
    finally { setGuardando(false) }
  }

  // ── Optimizar con IA ───────────────────────────────────────────
  async function optimizar() {
    setOptimizando(true); setError(''); setFlash('')
    try {
      const res = await fetch('/api/admin/domicilios-manuales/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domiciliario_id: domiciliarioId }),
      })
      const data = await res.json() as { ok?: boolean; orden?: string[]; message?: string; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al optimizar'); return }

      if (data.message) { setFlash(data.message); return }

      // Reordenar la lista local con el orden devuelto por la IA
      if (data.orden) {
        const idxMap = new Map(lista.map(m => [m.id, m]))
        const reordenada = data.orden.map(id => idxMap.get(id)).filter(Boolean) as Manual[]
        setLista(reordenada)
        setFlash('¡Ruta optimizada!')
        setTimeout(() => setFlash(''), 3000)
      }
      router.refresh()
    } catch { setError('Error de conexión') }
    finally { setOptimizando(false) }
  }

  return (
    <div className="space-y-3">

      {/* Encabezado + botón IA */}
      <div className="flex items-center justify-between gap-2">
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
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Optimizando...</>
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
        {lista.map((m, idx) => (
          <div
            key={m.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing select-none"
            style={{
              background: dragging === idx
                ? 'rgba(129,140,248,0.18)'
                : over === idx && dragging !== idx
                  ? 'rgba(129,140,248,0.12)'
                  : 'rgba(129,140,248,0.06)',
              border: over === idx && dragging !== idx
                ? '1px solid rgba(129,140,248,0.4)'
                : '1px solid rgba(129,140,248,0.12)',
              opacity: dragging === idx ? 0.6 : 1,
              transform: over === idx && dragging !== idx ? 'translateY(-1px)' : undefined,
            }}
          >
            {/* Drag handle + número */}
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <GripVertical className="h-3.5 w-3.5" style={{ color: `${tw}0.2)` }} />
              <span className="text-[11px] font-bold w-4 text-center" style={{ color: '#818cf8' }}>
                {idx + 1}
              </span>
            </div>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <FileText className="h-3 w-3 flex-shrink-0" style={{ color: '#818cf8' }} />
                <p className="text-xs font-bold text-white truncate">{m.nombre}</p>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.25)` }} />
                <p className="text-[11px] truncate" style={{ color: `${tw}0.45)` }}>{m.direccion}</p>
              </div>
              {m.telefono && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="h-2.5 w-2.5 flex-shrink-0" style={{ color: `${tw}0.2)` }} />
                  <p className="text-[10px]" style={{ color: `${tw}0.35)` }}>{m.telefono}</p>
                </div>
              )}
              {m.notas && (
                <p className="text-[10px] mt-0.5 truncate" style={{ color: `${tw}0.28)` }}>{m.notas}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {guardando && (
        <p className="text-[10px] flex items-center gap-1" style={{ color: `${tw}0.3)` }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Guardando orden...
        </p>
      )}
    </div>
  )
}
