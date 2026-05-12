'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const tw = 'rgba(255,255,255,'

interface Props {
  domiciliarioId: string
  domiciliarioNombre: string
}

export default function NuevoDomicilioManualModal({ domiciliarioId, domiciliarioNombre }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all w-full"
        style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8' }}
      >
        <MapPin className="h-3.5 w-3.5" />
        Agregar domicilio manual
      </button>
      {abierto && createPortal(
        <Modal
          domiciliarioId={domiciliarioId}
          domiciliarioNombre={domiciliarioNombre}
          onClose={() => setAbierto(false)}
        />,
        document.body
      )}
    </>
  )
}

function Modal({ domiciliarioId, domiciliarioNombre, onClose }: Props & { onClose: () => void }) {
  const router = useRouter()
  const [nombre,    setNombre]    = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState(false)

  // Cerrar con Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [guardando, onClose])

  async function guardar() {
    if (!nombre.trim() || !direccion.trim()) {
      setError('Nombre y dirección son obligatorios')
      return
    }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/admin/domicilios-manuales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domiciliario_id: domiciliarioId,
          nombre:   nombre.trim(),
          direccion: direccion.trim(),
          telefono: telefono.trim() || null,
          notas:    notas.trim()    || null,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al guardar'); return }
      setExito(true)
      router.refresh()
      setTimeout(onClose, 1400)
    } catch {
      setError('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !guardando) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,10,25,0.98)', border: `1px solid ${tw}0.1)` }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
          <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(129,140,248,0.12)' }}>
            <MapPin className="h-4 w-4" style={{ color: '#818cf8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">Domicilio manual</p>
            <p className="text-xs truncate" style={{ color: `${tw}0.4)` }}>{domiciliarioNombre}</p>
          </div>
          {!guardando && (
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
              style={{ color: `${tw}0.35)` }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Éxito */}
        {exito ? (
          <div className="p-10 text-center space-y-3">
            <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(129,140,248,0.15)' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#818cf8' }} />
            </div>
            <p className="font-bold text-white">¡Domicilio agregado!</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">

            {/* Nombre */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.55)` }}>
                Nombre <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre del destinatario"
                disabled={guardando}
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: 'white' }}
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.55)` }}>
                Dirección <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Calle, carrera, barrio..."
                disabled={guardando}
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: 'white' }}
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.45)` }}>
                Teléfono <span style={{ color: `${tw}0.25)` }}>(opcional)</span>
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="WhatsApp o celular"
                disabled={guardando}
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: 'white' }}
              />
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.45)` }}>
                Notas <span style={{ color: `${tw}0.25)` }}>(opcional)</span>
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Instrucciones, referencia, qué entregar..."
                rows={2}
                disabled={guardando}
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: 'white', fontFamily: 'inherit' }}
              />
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={guardando}
                className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all"
                style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !nombre.trim() || !direccion.trim()}
                className="flex-1 py-2.5 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: (!nombre.trim() || !direccion.trim() || guardando)
                    ? 'rgba(129,140,248,0.15)' : 'rgba(129,140,248,0.9)',
                  color: (!nombre.trim() || !direccion.trim() || guardando) ? '#818cf8' : 'white',
                }}
              >
                {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Agregar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
