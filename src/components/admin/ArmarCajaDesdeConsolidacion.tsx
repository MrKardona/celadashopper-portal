'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Package } from 'lucide-react'

const tw = 'rgba(255,255,255,'
const labelStyle = { color: `${tw}0.6)` }
const inputClass = 'glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

interface Props {
  paqueteIds: string[]
  bodega: string
  pesoTotal: number | null
  accentColor?: 'purple' | 'green'
}

export default function ArmarCajaDesdeConsolidacion({
  paqueteIds,
  bodega,
  pesoTotal,
  accentColor = 'purple',
}: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<'correo' | 'manejo'>('correo')
  const [courier, setCourier] = useState('')
  const [notas, setNotas] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const isGreen = accentColor === 'green'
  const accentColor1 = isGreen ? '#34d399' : '#c084fc'
  const accentBg    = isGreen ? 'rgba(52,211,153,0.12)' : 'rgba(168,85,247,0.12)'
  const accentBorder = isGreen ? 'rgba(52,211,153,0.3)' : 'rgba(168,85,247,0.3)'

  async function crear() {
    setCreando(true)
    setError('')

    // Step 1: create the caja
    const res1 = await fetch('/api/admin/cajas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bodega_destino: bodega,
        tipo,
        courier: courier.trim() || null,
        notas: notas.trim() || null,
      }),
    })
    const data1 = await res1.json() as { ok?: boolean; caja?: { id: string }; error?: string }
    if (!res1.ok || !data1.ok || !data1.caja) {
      setError(data1.error ?? 'Error al crear la caja')
      setCreando(false)
      return
    }

    const cajaId = data1.caja.id

    // Step 2: bulk-assign packages
    const res2 = await fetch(`/api/admin/cajas/${cajaId}/paquetes/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paquete_ids: paqueteIds }),
    })
    const data2 = await res2.json() as { ok?: boolean; error?: string }
    if (!res2.ok || !data2.ok) {
      setError(data2.error ?? 'Error al asignar los paquetes')
      setCreando(false)
      return
    }

    // Step 3: navigate
    router.push(`/admin/cajas/${cajaId}`)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-sm font-semibold transition-colors hover:opacity-80"
        style={{ color: accentColor1 }}
      >
        📦 Armar caja
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => !creando && setAbierto(false)}
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
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: accentBg }}
                >
                  <Package className="h-5 w-5" style={{ color: accentColor1 }} />
                </div>
                <div>
                  <h3 className="font-bold text-white">Armar caja de consolidación</h3>
                  <p className="text-xs" style={{ color: `${tw}0.4)` }}>
                    {paqueteIds.length} paquete{paqueteIds.length !== 1 ? 's' : ''} ·{' '}
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: accentBg, color: accentColor1, border: `1px solid ${accentBorder}` }}
                    >
                      📍 {BODEGA_LABELS[bodega] ?? bodega}
                    </span>
                    {pesoTotal !== null && (
                      <span className="ml-1.5" style={{ color: `${tw}0.35)` }}>
                        · {pesoTotal.toFixed(2)} lb
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !creando && setAbierto(false)}
                disabled={creando}
                className="disabled:opacity-50 p-1 rounded-lg transition-colors"
                style={{ color: `${tw}0.4)` }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Bodega (read-only badge) */}
            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>
                Ciudad destino
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{
                  background: accentBg,
                  border: `1px solid ${accentBorder}`,
                  color: accentColor1,
                }}
              >
                <span className="font-semibold">📍 {BODEGA_LABELS[bodega] ?? bodega}</span>
                <span className="text-[11px] ml-auto" style={{ color: `${tw}0.35)` }}>
                  Definida por los paquetes
                </span>
              </div>
            </div>

            {/* Tipo selector */}
            <div>
              <label className="text-xs font-medium block mb-2" style={labelStyle}>
                Tipo de caja *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipo('correo')}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                  style={
                    tipo === 'correo'
                      ? {
                          background: 'rgba(34,197,94,0.12)',
                          border: '1px solid rgba(34,197,94,0.45)',
                          color: '#4ade80',
                        }
                      : {
                          background: 'transparent',
                          border: `1px solid ${tw}0.1)`,
                          color: `${tw}0.4)`,
                        }
                  }
                >
                  <span>Correo</span>
                  <span className="text-[10px] font-normal opacity-70">≤ $200 USD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('manejo')}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                  style={
                    tipo === 'manejo'
                      ? {
                          background: 'rgba(249,115,22,0.12)',
                          border: '1px solid rgba(249,115,22,0.45)',
                          color: '#fb923c',
                        }
                      : {
                          background: 'transparent',
                          border: `1px solid ${tw}0.1)`,
                          color: `${tw}0.4)`,
                        }
                  }
                >
                  <span>Manejo</span>
                  <span className="text-[10px] font-normal opacity-70">&gt; $200 USD</span>
                </button>
              </div>
            </div>

            {/* Courier */}
            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>
                Courier (opcional)
              </label>
              <input
                type="text"
                value={courier}
                onChange={e => setCourier(e.target.value)}
                placeholder="Ej: USACO Express"
                className={inputClass}
              />
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones internas sobre esta caja..."
                rows={2}
                className={inputClass}
                style={{ resize: 'none' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="text-sm p-2 rounded-xl"
                style={{
                  color: '#f87171',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => !creando && setAbierto(false)}
                disabled={creando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                onClick={crear}
                disabled={creando}
                className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" /> Crear y asignar {paqueteIds.length} paquete{paqueteIds.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
