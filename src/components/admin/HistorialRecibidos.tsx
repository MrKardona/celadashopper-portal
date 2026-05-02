'use client'

import { useEffect, useState } from 'react'
import { Pencil, Save, X, CheckCircle2, Loader2, Camera, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface PaqueteRecibidoDB {
  id: string
  tracking_casilla: string
  tracking_origen: string | null
  tracking_usaco: string | null
  descripcion: string
  peso_libras: number | string | null
  fecha_recepcion_usa: string
  estado: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
  sin_asignar: boolean
  fotos_count: number
}

interface Props {
  /** Trigger numérico que cambia cuando se recibe un paquete nuevo, para refrescar */
  refreshKey?: number
}

export default function HistorialRecibidos({ refreshKey = 0 }: Props) {
  const [paquetes, setPaquetes] = useState<PaqueteRecibidoDB[]>([])
  const [cargando, setCargando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    fetch('/api/admin/recibir/historial')
      .then(r => r.json())
      .then((d: { paquetes?: PaqueteRecibidoDB[] }) => {
        if (!cancelado) setPaquetes(d.paquetes ?? [])
      })
      .catch(() => { if (!cancelado) setPaquetes([]) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [refreshKey])

  if (cargando) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center text-gray-400 text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial de hoy...
      </div>
    )
  }

  if (paquetes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
        No has recibido paquetes hoy todavía.
      </div>
    )
  }

  function refrescarUno(id: string, cambios: Partial<PaqueteRecibidoDB>) {
    setPaquetes(prev => prev.map(p => p.id === id ? { ...p, ...cambios } : p))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Recibidos hoy</span>
        <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
          {paquetes.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
        {paquetes.map(p => (
          <FilaPaquete
            key={p.id}
            paquete={p}
            editando={editandoId === p.id}
            onEditar={() => setEditandoId(p.id)}
            onCancelar={() => setEditandoId(null)}
            onGuardar={cambios => {
              refrescarUno(p.id, cambios)
              setEditandoId(null)
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Fila individual con edición inline ─────────────────────────────────────
function FilaPaquete({
  paquete, editando, onEditar, onCancelar, onGuardar,
}: {
  paquete: PaqueteRecibidoDB
  editando: boolean
  onEditar: () => void
  onCancelar: () => void
  onGuardar: (cambios: Partial<PaqueteRecibidoDB>) => void
}) {
  const [peso, setPeso] = useState(String(paquete.peso_libras ?? ''))
  const [trackingUsaco, setTrackingUsaco] = useState(paquete.tracking_usaco ?? '')
  const [descripcion, setDescripcion] = useState(paquete.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Resetear si cambia el paquete o se cancela
  useEffect(() => {
    if (editando) {
      setPeso(String(paquete.peso_libras ?? ''))
      setTrackingUsaco(paquete.tracking_usaco ?? '')
      setDescripcion(paquete.descripcion ?? '')
      setError('')
    }
  }, [editando, paquete])

  async function guardar() {
    setGuardando(true)
    setError('')
    const pesoNum = parseFloat(peso)
    if (isNaN(pesoNum) || pesoNum <= 0) {
      setError('Peso inválido')
      setGuardando(false)
      return
    }

    const res = await fetch(`/api/admin/paquetes/${paquete.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peso_libras: pesoNum,
        tracking_usaco: trackingUsaco.trim() || null,
        notificar: false, // editar desde historial NO re-notifica
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setGuardando(false)

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'No se pudo guardar')
      return
    }

    // Si la descripción cambió, hacer un PATCH separado (no soportado por el endpoint actual)
    // Por ahora solo peso y tracking_usaco editables
    onGuardar({
      peso_libras: pesoNum,
      tracking_usaco: trackingUsaco.trim() || null,
      descripcion,
    })
  }

  const horaCorta = format(new Date(paquete.fecha_recepcion_usa), 'HH:mm', { locale: es })

  if (editando) {
    return (
      <div className="px-5 py-4 bg-orange-50/40 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="font-mono font-bold text-orange-700">{paquete.tracking_casilla}</span>
          <span className="text-gray-400">·</span>
          <span className={paquete.sin_asignar ? 'text-amber-600 italic' : ''}>
            {paquete.cliente?.nombre_completo ?? '⏳ Sin asignar'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-0.5">Peso (lb)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={peso}
              onChange={e => setPeso(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-700 block mb-0.5">Tracking USACO</label>
            <input
              type="text"
              value={trackingUsaco}
              onChange={e => setTrackingUsaco(e.target.value)}
              placeholder="(opcional)"
              className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="flex-1 text-xs px-3 py-1.5 text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            <X className="h-3 w-3 inline mr-1" /> Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex-1 text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded gap-1 inline-flex items-center justify-center"
          >
            {guardando
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</>
              : <><Save className="h-3 w-3" /> Guardar</>}
          </button>
        </div>
        <a
          href={`/admin/paquetes/${paquete.id}`}
          className="block text-center text-[11px] text-orange-600 hover:underline"
        >
          Ver detalle completo del paquete →
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-gray-50 transition-colors group">
      <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${paquete.sin_asignar ? 'text-amber-400' : 'text-green-500'}`} />
      <span className="font-mono font-semibold text-orange-700 w-32 truncate text-xs">{paquete.tracking_casilla}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${paquete.sin_asignar ? 'text-amber-600 italic' : 'text-gray-700'}`}>
          {paquete.cliente?.nombre_completo ?? '⏳ Sin asignar'}
          {paquete.cliente?.numero_casilla && (
            <span className="text-gray-400 text-xs ml-1">({paquete.cliente.numero_casilla})</span>
          )}
        </p>
        <p className="text-xs text-gray-400 truncate">{paquete.descripcion}</p>
      </div>
      <span className="text-gray-500 font-medium text-xs whitespace-nowrap">{paquete.peso_libras} lb</span>
      {paquete.fotos_count > 0 && (
        <span className="text-blue-600 text-xs flex items-center gap-0.5" title={`${paquete.fotos_count} fotos`}>
          <Camera className="h-3 w-3" /> {paquete.fotos_count}
        </span>
      )}
      <span className="text-gray-400 text-xs w-10 text-right">{horaCorta}</span>
      <button
        type="button"
        onClick={onEditar}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 transition-opacity"
        title="Editar peso o tracking USACO"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
