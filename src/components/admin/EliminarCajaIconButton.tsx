'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); if (!cargando) setAbierto(false) }}
        >
          <div
            className="bg-white rounded-xl p-5 max-w-md w-full space-y-4"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          >
            <h3 className="font-bold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" /> Eliminar caja
            </h3>
            <p className="text-sm text-gray-700">
              ¿Estás seguro de que quieres eliminar la caja{' '}
              <span className="font-mono font-bold">{codigo}</span>?
            </p>
            {paquetesCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Esta caja tiene {paquetesCount} paquete{paquetesCount > 1 ? 's' : ''} adentro
                </p>
                <p className="text-xs leading-relaxed">
                  Al eliminar la caja, los paquetes volverán al estado &quot;Recibido en USA&quot;
                  y quedarán disponibles para meterlos en otra caja.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">Esta acción no se puede deshacer.</p>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierto(false) }}
                disabled={cargando}
              >
                Cancelar
              </Button>
              <Button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmar() }}
                disabled={cargando}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
