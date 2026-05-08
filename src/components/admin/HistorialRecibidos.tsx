'use client'

import { useEffect, useState } from 'react'
import { Pencil, Save, X, CheckCircle2, Loader2, Camera } from 'lucide-react'
import { soloHora } from '@/lib/fecha'

const tw = 'rgba(255,255,255,'

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
      <div className="glass-card p-8 flex items-center justify-center text-sm gap-2"
        style={{ color: `${tw}0.35)` }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial de hoy...
      </div>
    )
  }

  if (paquetes.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-sm" style={{ color: `${tw}0.35)` }}>
        No has recibido paquetes hoy todavía.
      </div>
    )
  }

  function refrescarUno(id: string, cambios: Partial<PaqueteRecibidoDB>) {
    setPaquetes(prev => prev.map(p => p.id === id ? { ...p, ...cambios } : p))
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <span className="text-sm font-semibold" style={{ color: `${tw}0.7)` }}>Recibidos hoy</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
          {paquetes.length}
        </span>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
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
        notificar: false,
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setGuardando(false)
    if (!res.ok || !data.ok) {
      setError(data.error ?? 'No se pudo guardar')
      return
    }
    onGuardar({ peso_libras: pesoNum, tracking_usaco: trackingUsaco.trim() || null, descripcion })
  }

  const horaCorta = soloHora(paquete.fecha_recepcion_usa)

  if (editando) {
    return (
      <div className="px-5 py-4 space-y-3"
        style={{ background: 'rgba(245,184,0,0.04)', borderTop: `1px solid ${tw}0.06)` }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: `${tw}0.55)` }}>
          <span className="font-mono font-bold" style={{ color: '#F5B800' }}>{paquete.tracking_casilla}</span>
          <span style={{ color: `${tw}0.2)` }}>·</span>
          <span style={{ color: paquete.sin_asignar ? '#F5B800' : `${tw}0.55)`, fontStyle: paquete.sin_asignar ? 'italic' : 'normal' }}>
            {paquete.cliente?.nombre_completo ?? '⏳ Sin asignar'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium block mb-0.5" style={{ color: `${tw}0.5)` }}>Peso (lb)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={peso}
              onChange={e => setPeso(e.target.value)}
              className="glass-input w-full px-2 py-1.5 text-sm rounded-lg focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium block mb-0.5" style={{ color: `${tw}0.5)` }}>Tracking USACO</label>
            <input
              type="text"
              value={trackingUsaco}
              onChange={e => setTrackingUsaco(e.target.value)}
              placeholder="(opcional)"
              className="glass-input w-full px-2 py-1.5 text-sm font-mono rounded-lg focus:outline-none"
            />
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="flex-1 text-xs px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.55)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.04)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="h-3 w-3" /> Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="flex-1 text-xs px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
            style={{ background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.22)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.15)')}
          >
            {guardando
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</>
              : <><Save className="h-3 w-3" /> Guardar</>}
          </button>
        </div>
        <a
          href={`/admin/paquetes/${paquete.id}`}
          className="block text-center text-[11px] transition-colors"
          style={{ color: '#F5B800' }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
        >
          Ver detalle completo del paquete →
        </a>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 text-sm transition-colors group"
      style={{ borderTop: `1px solid ${tw}0.05)` }}
      onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.03)`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <CheckCircle2 className="h-4 w-4 flex-shrink-0"
        style={{ color: paquete.sin_asignar ? '#F5B800' : '#34d399' }} />
      <span className="font-mono font-semibold w-32 truncate text-xs" style={{ color: '#F5B800' }}>
        {paquete.tracking_casilla}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate"
          style={{ color: paquete.sin_asignar ? '#F5B800' : `${tw}0.75)`, fontStyle: paquete.sin_asignar ? 'italic' : 'normal' }}>
          {paquete.cliente?.nombre_completo ?? '⏳ Sin asignar'}
          {paquete.cliente?.numero_casilla && (
            <span className="text-xs ml-1" style={{ color: `${tw}0.35)` }}>({paquete.cliente.numero_casilla})</span>
          )}
        </p>
        <p className="text-xs truncate" style={{ color: `${tw}0.4)` }}>{paquete.descripcion}</p>
      </div>
      <span className="font-medium text-xs whitespace-nowrap" style={{ color: `${tw}0.5)` }}>
        {paquete.peso_libras} lb
      </span>
      {paquete.fotos_count > 0 && (
        <span className="text-xs flex items-center gap-0.5" style={{ color: '#8899ff' }}
          title={`${paquete.fotos_count} fotos`}>
          <Camera className="h-3 w-3" /> {paquete.fotos_count}
        </span>
      )}
      <span className="text-xs w-10 text-right" style={{ color: `${tw}0.35)` }}>{horaCorta}</span>
      <button
        type="button"
        onClick={onEditar}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
        style={{ color: `${tw}0.35)` }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F5B800')}
        onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
        title="Editar peso o tracking USACO"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
