'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Resultado = {
  consultadas: number
  actualizadas: number
  paquetes_notificados: number
  mensaje?: string
}

type Estado = 'idle' | 'loading' | 'ok' | 'error'

export default function SyncCajasUsacoButton() {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error,     setError]     = useState('')
  const router = useRouter()

  // Auto-reset a idle tras 4 segundos
  useEffect(() => {
    if (estado !== 'ok' && estado !== 'error') return
    const t = setTimeout(() => setEstado('idle'), 4000)
    return () => clearTimeout(t)
  }, [estado])

  async function sincronizar() {
    setEstado('loading')
    setResultado(null)
    setError('')

    try {
      const res  = await fetch('/api/admin/usaco/sync-cajas', { method: 'POST' })
      const data = await res.json() as Resultado & { error?: string }

      if (!res.ok) throw new Error(data.error ?? 'Error al sincronizar')

      setResultado(data)
      setEstado('ok')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setEstado('error')
    }
  }

  const isLoading = estado === 'loading'

  // Texto del toast según resultado
  const toastText = resultado
    ? resultado.actualizadas > 0
      ? `✓ Sincronizado — ${resultado.actualizadas} caja${resultado.actualizadas !== 1 ? 's' : ''} actualizada${resultado.actualizadas !== 1 ? 's' : ''}`
      : '✓ Sincronizado correctamente con USACO'
    : '✓ Sincronizado correctamente con USACO'

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={sincronizar}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
        style={{
          background: 'rgba(245,184,0,0.08)',
          border: '1px solid rgba(245,184,0,0.22)',
          color: '#F5B800',
        }}
      >
        {isLoading
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : estado === 'ok'
          ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
          : estado === 'error'
          ? <AlertCircle className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
          : <Package className="h-3.5 w-3.5" />
        }
        {isLoading ? 'Consultando USACO…' : 'Sync cajas USA'}
      </button>

      {/* Toast compacto */}
      {estado === 'ok' && (
        <p className="text-xs px-1 transition-opacity" style={{ color: '#34d399' }}>
          {toastText}
        </p>
      )}

      {estado === 'error' && error && (
        <p className="text-xs px-1" style={{ color: '#f87171' }}>✕ {error}</p>
      )}
    </div>
  )
}
