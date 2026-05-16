'use client'

import { useState } from 'react'
import { Layers, Loader2, X, CheckCircle2 } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  paqueteIds: string[]
  clienteNombre: string
  descripciones: string[]
}

export default function CrearLoteButton({ paqueteIds, clienteNombre, descripciones }: Props) {
  const [abierto, setAbierto]   = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')
  const [exito, setExito]       = useState(false)

  async function crear() {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/admin/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paquete_ids: paqueteIds }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error creando el lote'); return }
      setExito(true)
      setTimeout(() => window.location.reload(), 900)
    } catch { setError('Error de conexión') }
    finally { setCargando(false) }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
        style={{ background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.1)')}
      >
        <Layers className="h-3 w-3" />
        Crear lote
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => !cargando && !exito && setAbierto(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,10,25,0.96)', backdropFilter: 'blur(20px)', border: `1px solid ${tw}0.1)` }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,184,0,0.12)' }}>
                <Layers className="h-4 w-4" style={{ color: '#F5B800' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Crear lote de entrega</p>
                <p className="text-xs truncate" style={{ color: `${tw}0.45)` }}>{clienteNombre}</p>
              </div>
              <button onClick={() => setAbierto(false)} disabled={cargando}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: `${tw}0.4)` }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {exito ? (
              <div className="p-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(245,184,0,0.12)' }}>
                  <CheckCircle2 className="h-6 w-6" style={{ color: '#F5B800' }} />
                </div>
                <p className="font-bold text-white">¡Lote creado!</p>
                <p className="text-sm" style={{ color: `${tw}0.5)` }}>Los {paqueteIds.length} paquetes se gestionarán juntos.</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm" style={{ color: `${tw}0.65)` }}>
                  Se agruparán <strong className="text-white">{paqueteIds.length} paquetes</strong> en un lote. Podrás asignar un domiciliario y confirmar la entrega de todos a la vez. <span style={{ color: `${tw}0.45)` }}>El cliente los seguirá viendo por separado.</span>
                </p>

                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tw}0.07)` }}>
                  {descripciones.map((desc, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm"
                      style={{ borderTop: i > 0 ? `1px solid ${tw}0.06)` : undefined }}>
                      <span style={{ color: '#F5B800' }}>📦</span>
                      <span className="truncate text-white">{desc}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    disabled={cargando}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                    style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={crear}
                    disabled={cargando}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.28)' }}>
                    {cargando
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                      : <><Layers className="h-4 w-4" /> Crear lote</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
