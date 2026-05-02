'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  paqueteId: string
  trackingCasilla: string
  descripcion: string
}

export default function EliminarPaqueteButton({ paqueteId, trackingCasilla, descripcion }: Props) {
  const router = useRouter()
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

    // Hard navigation para refrescar la lista
    window.location.href = '/admin/paquetes'
  }

  function cerrar() {
    if (eliminando) return
    setAbierto(false)
    setError('')
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-2"
        onClick={() => setAbierto(true)}
      >
        <Trash2 className="h-4 w-4" />
        Eliminar paquete
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={cerrar}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Eliminar paquete</h3>
                  <p className="text-xs text-gray-500">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                onClick={cerrar}
                disabled={eliminando}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 text-sm">
              <div>
                <p className="text-xs text-red-600 font-medium">Tracking</p>
                <p className="font-mono font-semibold text-red-900">{trackingCasilla}</p>
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium">Producto</p>
                <p className="text-red-900">{descripcion}</p>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p>¿Estás seguro de que quieres eliminar este paquete?</p>
              <p className="text-xs text-gray-500 mt-1">
                Se borrará permanentemente junto con sus fotos, historial de eventos y notificaciones.
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={cerrar}
                disabled={eliminando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300"
                onClick={handleEliminar}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
