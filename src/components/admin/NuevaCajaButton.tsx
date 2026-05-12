'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, X, Loader2, Box } from 'lucide-react'

const tw = 'rgba(255,255,255,'

const BODEGAS = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla' },
]

const labelStyle = { color: `${tw}0.6)` }
const inputClass = 'glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none'

export default function NuevaCajaButton() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [bodega, setBodega] = useState<string>('medellin')
  const [tipo, setTipo] = useState<'correo' | 'manejo'>('correo')
  const [courier, setCourier] = useState('')
  const [notas, setNotas] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  async function crear() {
    setCreando(true)
    setError('')
    const res = await fetch('/api/admin/cajas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodega_destino: bodega, tipo, courier: courier.trim() || null, notas: notas.trim() || null }),
    })
    const data = await res.json() as { ok?: boolean; caja?: { id: string }; error?: string }
    setCreando(false)
    if (!res.ok || !data.ok || !data.caja) {
      setError(data.error ?? 'Error al crear caja')
      return
    }
    router.push(`/admin/cajas/${data.caja.id}`)
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="btn-gold flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
      >
        <PlusCircle className="h-4 w-4" />
        Nueva caja
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,184,0,0.12)' }}>
                  <Box className="h-5 w-5" style={{ color: '#F5B800' }} />
                </div>
                <div>
                  <h3 className="font-bold text-white">Crear nueva caja</h3>
                  <p className="text-xs" style={{ color: `${tw}0.4)` }}>Para consolidar paquetes</p>
                </div>
              </div>
              <button
                onClick={() => setAbierto(false)}
                disabled={creando}
                className="disabled:opacity-50 p-1 rounded-lg transition-colors"
                style={{ color: `${tw}0.4)` }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>
                Ciudad destino en Colombia *
              </label>
              <select value={bodega} onChange={e => setBodega(e.target.value)} className={inputClass}>
                {BODEGAS.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>
                Por defecto solo aceptará paquetes con esta ciudad destino. Podrás añadir otros con confirmación.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium block mb-2" style={labelStyle}>Tipo de caja *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipo('correo')}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                  style={tipo === 'correo' ? {
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.45)',
                    color: '#4ade80',
                  } : {
                    background: 'transparent',
                    border: `1px solid ${tw}0.1)`,
                    color: `${tw}0.4)`,
                  }}
                >
                  <span>Correo</span>
                  <span className="text-[10px] font-normal opacity-70">≤ $200 USD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('manejo')}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                  style={tipo === 'manejo' ? {
                    background: 'rgba(249,115,22,0.12)',
                    border: '1px solid rgba(249,115,22,0.45)',
                    color: '#fb923c',
                  } : {
                    background: 'transparent',
                    border: `1px solid ${tw}0.1)`,
                    color: `${tw}0.4)`,
                  }}
                >
                  <span>Manejo</span>
                  <span className="text-[10px] font-normal opacity-70">&gt; $200 USD</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>Courier (opcional)</label>
              <input type="text" value={courier} onChange={e => setCourier(e.target.value)}
                placeholder="Ej: USACO Express" className={inputClass} />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1" style={labelStyle}>Notas (opcional)</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones internas sobre esta caja..." rows={2}
                className={inputClass} style={{ resize: 'none' }} />
            </div>

            {error && (
              <div className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
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
                {creando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <><PlusCircle className="h-4 w-4" /> Crear caja</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
