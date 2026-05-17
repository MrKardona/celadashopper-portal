'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2, Calendar } from 'lucide-react'

export default function InformeDomiciliariosButton() {
  const hoyBog  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [fecha,     setFecha]     = useState(hoyBog)
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')

  async function descargar() {
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/admin/domiciliarios/informe-excel?fecha=${fecha}`)
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Error al generar informe')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `informe-domicilios-${fecha}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
        <Calendar className="h-3.5 w-3.5 ml-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          max={hoyBog}
          className="px-2 py-2 text-xs bg-transparent focus:outline-none"
          style={{ color: 'rgba(255,255,255,0.7)', colorScheme: 'dark' }}
        />
      </div>

      <button
        onClick={descargar}
        disabled={cargando || !fecha}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
      >
        {cargando
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
          : <><FileSpreadsheet className="h-3.5 w-3.5" /> Informe Excel</>}
      </button>

      {error && <p className="text-[11px] w-full" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}
