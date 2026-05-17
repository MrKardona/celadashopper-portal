'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bike, ChevronDown, X, Loader2, CheckCircle2 } from 'lucide-react'

interface Domiciliario {
  id: string
  nombre_completo: string
}

interface Props {
  paqueteId: string
  descripcion: string
  domiciliarioActual: { id: string; nombre_completo: string } | null
  domiciliarios: Domiciliario[]
}

const tw = 'rgba(255,255,255,'

export default function AsignarDomiciliarioButton({
  paqueteId, descripcion, domiciliarioActual, domiciliarios,
}: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function asignar(domiciliarioId: string) {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/asignar-domiciliario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domiciliario_id: domiciliarioId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al asignar'); return }
      setAbierto(false)
      router.refresh()
    } catch { setError('Error de conexión') }
    finally { setCargando(false) }
  }

  async function desasignar() {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/asignar-domiciliario`, { method: 'DELETE' })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al desasignar'); return }
      setAbierto(false)
      router.refresh()
    } catch { setError('Error de conexión') }
    finally { setCargando(false) }
  }

  if (domiciliarios.length === 0) return null

  return (
    <div className="relative">
      {domiciliarioActual ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}>
            <Bike className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{domiciliarioActual.nombre_completo}</span>
          </div>
          <button
            onClick={() => setAbierto(true)}
            disabled={cargando}
            title="Cambiar domiciliario"
            className="px-2.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          disabled={cargando}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
        >
          <Bike className="h-3.5 w-3.5" />
          Asignar domiciliario
        </button>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => !cargando && setAbierto(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,10,25,0.95)', backdropFilter: 'blur(20px)', border: `1px solid ${tw}0.1)` }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)' }}>
                <Bike className="h-4 w-4" style={{ color: '#818cf8' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Asignar domiciliario</p>
                <p className="text-xs truncate" style={{ color: `${tw}0.45)` }}>{descripcion}</p>
              </div>
              <button onClick={() => setAbierto(false)} disabled={cargando}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lista de domiciliarios */}
            <div className="py-2 max-h-64 overflow-y-auto">
              {domiciliarios.map(d => (
                <button
                  key={d.id}
                  onClick={() => asignar(d.id)}
                  disabled={cargando || d.id === domiciliarioActual?.id}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors disabled:opacity-40"
                  style={{ color: d.id === domiciliarioActual?.id ? '#818cf8' : `${tw}0.75)` }}
                  onMouseEnter={e => { if (d.id !== domiciliarioActual?.id) e.currentTarget.style.background = `${tw}0.05)` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {cargando
                    ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#818cf8' }} />
                    : d.id === domiciliarioActual?.id
                      ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: '#818cf8' }} />
                      : <Bike className="h-4 w-4 flex-shrink-0" style={{ color: `${tw}0.3)` }} />
                  }
                  <span className="text-sm font-medium">{d.nombre_completo}</span>
                  {d.id === domiciliarioActual?.id && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                      Actual
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Desasignar si hay uno */}
            {domiciliarioActual && (
              <div className="px-5 pb-4 pt-2" style={{ borderTop: `1px solid ${tw}0.07)` }}>
                <button
                  onClick={desasignar}
                  disabled={cargando}
                  className="w-full py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Quitar asignación
                </button>
              </div>
            )}

            {error && (
              <p className="px-5 pb-3 text-xs" style={{ color: '#f87171' }}>{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
