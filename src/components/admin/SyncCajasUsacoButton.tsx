'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Resultado = {
  consultadas: number
  actualizadas: number
  paquetes_avanzados?: number
  mensaje?: string
}
type Estado = 'idle' | 'loading' | 'ok' | 'error'

export default function SyncCajasUsacoButton() {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error,     setError]     = useState('')
  const router = useRouter()

  useEffect(() => {
    if (estado !== 'ok' && estado !== 'error') return
    const t = setTimeout(() => { setEstado('idle'); setResultado(null) }, 6000)
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

  function toastText(r: Resultado) {
    if (r.mensaje) return r.mensaje
    const partes: string[] = []
    if (r.actualizadas > 0)
      partes.push(`${r.actualizadas} caja${r.actualizadas !== 1 ? 's' : ''} actualizadas`)
    if ((r.paquetes_avanzados ?? 0) > 0)
      partes.push(`${r.paquetes_avanzados} paquete${r.paquetes_avanzados !== 1 ? 's' : ''} avanzados`)
    if (partes.length === 0)
      return `${r.consultadas} cajas consultadas — sin cambios`
    return partes.join(' · ')
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sincronizar}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
        style={{
          background: estado === 'ok'
            ? 'rgba(52,211,153,0.1)'
            : estado === 'error'
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(245,184,0,0.08)',
          border: `1px solid ${
            estado === 'ok'   ? 'rgba(52,211,153,0.25)'
            : estado === 'error' ? 'rgba(239,68,68,0.25)'
            : 'rgba(245,184,0,0.22)'
          }`,
          color: estado === 'ok' ? '#34d399' : estado === 'error' ? '#f87171' : '#F5B800',
        }}
      >
        {isLoading
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : estado === 'ok'
          ? <CheckCircle2 className="h-3.5 w-3.5" />
          : estado === 'error'
          ? <AlertCircle className="h-3.5 w-3.5" />
          : <RefreshCw className="h-3.5 w-3.5" />}
        {isLoading ? 'Consultando USACO…' : 'Sync USACO'}
      </button>

      {estado === 'ok' && resultado && (
        <p className="text-[11px] text-right" style={{ color: '#34d399' }}>
          ✓ {toastText(resultado)}
        </p>
      )}
      {estado === 'error' && error && (
        <p className="text-[11px] text-right" style={{ color: '#f87171' }}>✕ {error}</p>
      )}
    </div>
  )
}
