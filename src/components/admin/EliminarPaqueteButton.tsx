'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  paqueteId: string
  trackingCasilla: string
  descripcion: string
}

export default function EliminarPaqueteButton({ paqueteId, trackingCasilla, descripcion }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')

  async function handleEliminar() {
    setEliminando(true)
    setError('')
    const res = await fetch(`/api/admin/paquetes/${paqueteId}`, { method: 'DELETE' })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      setError(data.error ?? 'No se pudo eliminar el paquete')
      setEliminando(false)
      return
    }
    window.location.href = '/admin/paquetes'
  }

  function cerrar() {
    if (eliminando) return
    setAbierto(false)
    setError('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
      >
        <Trash2 className="h-4 w-4" />
        Eliminar paquete
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={cerrar}
        >
          <div
            className="max-w-md w-full p-6 space-y-4"
            style={{
              background: 'rgba(10,10,25,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${tw}0.1)`,
              borderRadius: '1rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <AlertTriangle className="h-5 w-5" style={{ color: '#f87171' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white">Eliminar paquete</h3>
                  <p className="text-xs" style={{ color: `${tw}0.4)` }}>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                onClick={cerrar}
                disabled={eliminando}
                className="disabled:opacity-50 p-1 rounded-lg transition-colors"
                style={{ color: `${tw}0.4)` }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl p-3 space-y-2 text-sm"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: '#f87171' }}>Tracking</p>
                <p className="font-mono font-semibold text-white">{trackingCasilla}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: '#f87171' }}>Producto</p>
                <p style={{ color: `${tw}0.8)` }}>{descripcion}</p>
              </div>
            </div>

            <div className="text-sm" style={{ color: `${tw}0.65)` }}>
              <p>¿Estás seguro de que quieres eliminar este paquete?</p>
              <p className="text-xs mt-1" style={{ color: `${tw}0.4)` }}>
                Se borrará permanentemente junto con sus fotos, historial de eventos y notificaciones.
              </p>
            </div>

            {error && (
              <div className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={cerrar}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                {eliminando ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
