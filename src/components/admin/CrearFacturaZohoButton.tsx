'use client'

import { useState } from 'react'
import { FileText, Loader2, ExternalLink, CheckCircle } from 'lucide-react'

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

  // Si ya tenía factura al cargar la página
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
    } catch (err) {
      setError('Error de red al conectar con Zoho.')
    } finally {
      setCargando(false)
    }
  }

  // Ya existe factura (desde DB o recién creada)
  if (facturaExistente || resultado) {
    const url   = resultado?.zoho_url ?? zohoUrlExistente!
    const num   = resultado?.invoice_number ?? facturaId
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Factura creada en Zoho</p>
            {num && <p className="text-xs text-green-600 font-mono">{num}</p>}
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 border border-green-300 bg-white px-2.5 py-1.5 rounded-md hover:bg-green-50 transition-colors whitespace-nowrap"
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
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border
          disabled:opacity-50 disabled:cursor-not-allowed
          bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
      >
        {cargando
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando en Zoho...</>
          : <><FileText className="h-4 w-4" /> Crear factura en Zoho Inventory</>
        }
      </button>

      {!costoServicio && (
        <p className="text-xs text-amber-600 text-center">
          ⚠️ Calcula el costo del servicio primero
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
