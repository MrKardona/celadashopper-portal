'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function SincronizarZohoItemsButton() {
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  async function sincronizar() {
    setCargando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/admin/zoho/sincronizar-items', { method: 'POST' })
      const data = await res.json() as {
        ok?: boolean
        resultados?: { categoria: string; item_id: string; accion: string }[]
        error?: string
      }
      if (data.ok) {
        const creados = data.resultados?.filter(r => r.accion === 'creado').length ?? 0
        const actualizados = data.resultados?.filter(r => r.accion === 'actualizado').length ?? 0
        setResultado({ ok: true, msg: `✅ ${creados} creados, ${actualizados} actualizados en Zoho` })
      } else {
        setResultado({ ok: false, msg: data.error ?? 'Error al sincronizar' })
      }
    } catch {
      setResultado({ ok: false, msg: 'Error de red' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={sincronizar}
        disabled={cargando}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.12)')}
      >
        <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
        {cargando ? 'Sincronizando...' : 'Sincronizar artículos en Zoho'}
      </button>
      {resultado && (
        <div className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: resultado.ok ? '#34d399' : '#f87171' }}>
          {resultado.ok
            ? <CheckCircle className="h-4 w-4" />
            : <AlertCircle className="h-4 w-4" />}
          {resultado.msg}
        </div>
      )}
    </div>
  )
}
