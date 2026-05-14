'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  nombre: string
}

export default function EliminarDomiciliarioButton({ id, nombre }: Props) {
  const [step, setStep]     = useState<'idle' | 'confirm' | 'loading'>('idle')
  const [error, setError]   = useState<string | null>(null)
  const router              = useRouter()

  async function handleEliminar() {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch(`/api/admin/domiciliarios/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al eliminar')
      }
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all w-full"
        style={{ border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.6)' }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar domiciliario
      </button>
    )
  }

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs"
        style={{ border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.4)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Eliminando…
      </div>
    )
  }

  // step === 'confirm'
  return (
    <div className="rounded-xl p-3 space-y-2.5"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>¿Eliminar a {nombre}?</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Sus paquetes pendientes quedarán sin asignar. El historial de entregas se conserva.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[11px]" style={{ color: '#f87171' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => { setStep('idle'); setError(null) }}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
          style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleEliminar}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
        >
          Sí, eliminar
        </button>
      </div>
    </div>
  )
}
