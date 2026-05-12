'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function CompletarDomicilioManualButton({ id }: { id: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'loading' | 'done'>('idle')

  async function completar() {
    if (estado !== 'idle') return
    setEstado('loading')
    try {
      const res = await fetch(`/api/domiciliario/domicilios-manuales/${id}/completar`, { method: 'POST' })
      if (res.ok) {
        setEstado('done')
        setTimeout(() => router.refresh(), 900)
      } else {
        setEstado('idle')
      }
    } catch {
      setEstado('idle')
    }
  }

  if (estado === 'done') {
    return (
      <div className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
        <CheckCircle2 className="h-4 w-4" /> ¡Completado!
      </div>
    )
  }

  return (
    <button
      onClick={completar}
      disabled={estado === 'loading'}
      className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
      style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}
    >
      {estado === 'loading'
        ? <><Loader2 className="h-4 w-4 animate-spin" /> Completando...</>
        : <><CheckCircle2 className="h-4 w-4" /> Marcar como completado</>}
    </button>
  )
}
