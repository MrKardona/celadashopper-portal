'use client'

import { useState } from 'react'
import { Unlink, Loader2 } from 'lucide-react'

interface Props { loteId: string }

export default function DisolverLoteButton({ loteId }: Props) {
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function disolver() {
    setCargando(true)
    try {
      const res = await fetch(`/api/admin/lotes/${loteId}`, { method: 'DELETE' })
      if (res.ok) window.location.reload()
    } catch { /* silent */ }
    finally { setCargando(false) }
  }

  if (confirmar) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px]" style={{ color: 'rgba(248,113,113,0.8)' }}>¿Disolver?</span>
        <button
          type="button"
          onClick={disolver}
          disabled={cargando}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full disabled:opacity-50 transition-colors"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
          {cargando ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Sí'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmar(false)}
          disabled={cargando}
          className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          No
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmar(true)}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-all"
      style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      title="Disolver lote (los paquetes quedan independientes)">
      <Unlink className="h-2.5 w-2.5" />
      Disolver
    </button>
  )
}
