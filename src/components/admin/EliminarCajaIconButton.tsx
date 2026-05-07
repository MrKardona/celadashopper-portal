'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertCircle } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  cajaId: string
  codigo: string
  paquetesCount: number
}

export default function EliminarCajaIconButton({ cajaId, codigo, paquetesCount }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  function abrirModal(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setAbierto(true)
  }

  async function confirmar() {
    setCargando(true)
    setError('')
    const res = await fetch(`/api/admin/cajas/${cajaId}`, { method: 'DELETE' })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Error al eliminar')
      return
    }
    setAbierto(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        title="Eliminar caja"
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: `${tw}0.3)` }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#f87171'
          e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = `${tw}0.3)`
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { e.stopPropagation(); if (!cargando) setAbierto(false) }}
        >
          <div
            className="max-w-md w-full p-5 space-y-4"
            style={{
              background: 'rgba(10,10,25,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${tw}0.1)`,
              borderRadius: '1rem',
            }}
            onClick={e => { e.preventDefault(); e.stopPropagation() }}
          >
            <h3 className="font-bold text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5" style={{ color: '#f87171' }} /> Eliminar caja
            </h3>
            <p className="text-sm" style={{ color: `${tw}0.65)` }}>
              ¿Estás seguro de que quieres eliminar la caja{' '}
              <span className="font-mono font-bold text-white">{codigo}</span>?
            </p>
            {paquetesCount > 0 && (
              <div className="rounded-xl p-3 text-sm space-y-1"
                style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.2)' }}>
                <p className="font-semibold flex items-center gap-1" style={{ color: '#F5B800' }}>
                  <AlertCircle className="h-4 w-4" /> Esta caja tiene {paquetesCount} paquete{paquetesCount > 1 ? 's' : ''} adentro
                </p>
                <p className="text-xs leading-relaxed" style={{ color: `${tw}0.5)` }}>
                  Al eliminar la caja, los paquetes volverán al estado &quot;Recibido en USA&quot;
                  y quedarán disponibles para meterlos en otra caja.
                </p>
              </div>
            )}
            <p className="text-xs" style={{ color: `${tw}0.35)` }}>Esta acción no se puede deshacer.</p>
            {error && (
              <p className="text-sm px-3 py-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); setAbierto(false) }}
                disabled={cargando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); confirmar() }}
                disabled={cargando}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
              >
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
