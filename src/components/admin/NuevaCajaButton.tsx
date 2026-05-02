'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, X, Loader2, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'

const BODEGAS = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla' },
]

export default function NuevaCajaButton() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [bodega, setBodega] = useState<string>('medellin')
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
      body: JSON.stringify({
        bodega_destino: bodega,
        courier: courier.trim() || null,
        notas: notas.trim() || null,
      }),
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
      <Button
        onClick={() => setAbierto(true)}
        className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
      >
        <PlusCircle className="h-4 w-4" />
        Nueva caja
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !creando && setAbierto(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Box className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Crear nueva caja</h3>
                  <p className="text-xs text-gray-500">Para consolidar paquetes</p>
                </div>
              </div>
              <button
                onClick={() => setAbierto(false)}
                disabled={creando}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Ciudad destino en Colombia *
              </label>
              <select
                value={bodega}
                onChange={e => setBodega(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {BODEGAS.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Por defecto solo aceptará paquetes con esta ciudad destino. Podrás añadir otros con confirmación.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Courier (opcional)
              </label>
              <input
                type="text"
                value={courier}
                onChange={e => setCourier(e.target.value)}
                placeholder="Ej: USACO Express"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones internas sobre esta caja..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAbierto(false)}
                disabled={creando}
              >
                Cancelar
              </Button>
              <Button
                onClick={crear}
                disabled={creando}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2"
              >
                {creando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <><PlusCircle className="h-4 w-4" /> Crear caja</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
