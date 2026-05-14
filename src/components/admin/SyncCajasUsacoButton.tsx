'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Estado = 'idle' | 'loading' | 'ok' | 'error'

type Resultado = {
  consultadas: number
  actualizadas: number
  paquetes_notificados: number
  mensaje?: string
  detalles?: { caja: string; estado: string }[]
}

export default function SyncCajasUsacoButton() {
  const [estado, setEstado]       = useState<Estado>('idle')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError]         = useState('')
  const router                    = useRouter()

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
      if (data.actualizadas > 0) router.refresh()

      // Volver a idle tras 6 s
      setTimeout(() => setEstado('idle'), 6_000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setEstado('error')
      setTimeout(() => setEstado('idle'), 5_000)
    }
  }

  const isLoading = estado === 'loading'

  return (
    <div className="flex flex-col gap-2">
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
        {isLoading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : estado === 'ok' ? (
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
        ) : estado === 'error' ? (
          <AlertCircle className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
        ) : (
          <Package className="h-3.5 w-3.5" />
        )}
        {isLoading ? 'Consultando USACO…' : 'Sync cajas USA'}
      </button>

      {/* Resultado */}
      {estado === 'ok' && resultado && (
        <div className="rounded-xl px-3 py-2.5 text-xs space-y-1"
          style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)' }}>
          {resultado.mensaje ? (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>{resultado.mensaje}</p>
          ) : (
            <>
              <p style={{ color: '#34d399' }}>
                ✅ {resultado.actualizadas} caja{resultado.actualizadas !== 1 ? 's' : ''} recibida{resultado.actualizadas !== 1 ? 's' : ''} en Colombia
              </p>
              {resultado.paquetes_notificados > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {resultado.paquetes_notificados} paquete{resultado.paquetes_notificados !== 1 ? 's' : ''} notificado{resultado.paquetes_notificados !== 1 ? 's' : ''}
                </p>
              )}
              {resultado.actualizadas === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {resultado.consultadas} caja{resultado.consultadas !== 1 ? 's' : ''} consultada{resultado.consultadas !== 1 ? 's' : ''} — ninguna llegó aún a Colombia
                </p>
              )}
            </>
          )}
        </div>
      )}

      {estado === 'error' && error && (
        <p className="text-xs px-1" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  )
}
