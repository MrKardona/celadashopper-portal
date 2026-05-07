'use client'

import { useState } from 'react'
import { FileText, Loader2, ExternalLink, CheckCircle } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  paqueteId: string
  facturaId: string | null
  costoServicio: number | null
}

export default function CrearFacturaZohoButton({ paqueteId, facturaId, costoServicio }: Props) {
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{
    invoice_id: string
    invoice_number: string
    zoho_url: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const facturaExistente = facturaId
  const zohoUrlExistente = facturaId
    ? `https://inventory.zoho.com/app#/invoices/${facturaId}`
    : null

  async function handleCrear() {
    if (!costoServicio || costoServicio <= 0) {
      setError('El paquete necesita un costo de servicio calculado antes de facturar.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/zoho/crear-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paquete_id: paqueteId }),
      })
      const data = await res.json() as {
        ok?: boolean
        invoice_id?: string
        invoice_number?: string
        zoho_url?: string
        error?: string
        factura_id?: string
      }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error desconocido al crear la factura.')
      } else {
        setResultado({
          invoice_id: data.invoice_id!,
          invoice_number: data.invoice_number!,
          zoho_url: data.zoho_url!,
        })
      }
    } catch {
      setError('Error de red al conectar con Zoho.')
    } finally {
      setCargando(false)
    }
  }

  if (facturaExistente || resultado) {
    const url = resultado?.zoho_url ?? zohoUrlExistente!
    const num = resultado?.invoice_number ?? facturaId
    return (
      <div className="rounded-xl p-3 flex items-center justify-between gap-3"
        style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#34d399' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Factura creada en Zoho</p>
            {num && <p className="text-xs font-mono" style={{ color: 'rgba(52,211,153,0.7)' }}>{num}</p>}
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.12)')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver en Zoho
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCrear}
        disabled={cargando || !costoServicio}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(99,130,255,0.12)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.12)')}
      >
        {cargando
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando en Zoho...</>
          : <><FileText className="h-4 w-4" /> Crear factura en Zoho Inventory</>}
      </button>

      {!costoServicio && (
        <p className="text-xs text-center" style={{ color: '#F5B800' }}>
          ⚠️ Calcula el costo del servicio primero
        </p>
      )}

      {error && (
        <div className="rounded-xl px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
