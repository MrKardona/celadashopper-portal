'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, ExternalLink, CheckCircle, RefreshCw, Clock } from 'lucide-react'

interface Props {
  paqueteId: string
  facturaId: string | null
  costoServicio: number | null
  facturaPagada?: boolean | null
}

export default function CrearFacturaZohoButton({ paqueteId, facturaId, costoServicio, facturaPagada }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [resultado, setResultado] = useState<{ invoice_id: string; invoice_number: string; zoho_url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const facturaExistente = facturaId
  const zohoUrl = resultado?.zoho_url ?? (facturaId ? `https://inventory.zoho.com/app#/invoices/${facturaId}` : null)
  const invoiceNum = resultado?.invoice_number ?? facturaId

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
      const data = await res.json() as { ok?: boolean; invoice_id?: string; invoice_number?: string; zoho_url?: string; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error desconocido al crear la factura.')
      } else {
        setResultado({ invoice_id: data.invoice_id!, invoice_number: data.invoice_number!, zoho_url: data.zoho_url! })
        router.refresh()
      }
    } catch {
      setError('Error de red al conectar con Zoho.')
    } finally {
      setCargando(false)
    }
  }

  async function handleSincronizar() {
    setSincronizando(true)
    setSyncMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/zoho/sincronizar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paquete_id: paqueteId }),
      })
      const data = await res.json() as { ok?: boolean; status?: string; factura_pagada?: boolean; actualizado?: boolean; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al sincronizar con Zoho')
      } else {
        const estadoZoho: Record<string, string> = {
          paid: '✅ Pagada en Zoho',
          sent: '📨 Enviada al cliente',
          viewed: '👁 Vista por el cliente',
          overdue: '⏰ Vencida',
          void: '🚫 Anulada',
          draft: '📝 Borrador',
        }
        const label = estadoZoho[data.status ?? ''] ?? `Estado: ${data.status}`
        setSyncMsg(data.actualizado ? `${label} — actualizado` : `${label} — ya estaba al día`)
        if (data.actualizado) router.refresh()
      }
    } catch {
      setError('Error de red al sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  // ── Factura ya creada ────────────────────────────────────────────────────────
  if (facturaExistente || resultado) {
    const pagada = facturaPagada

    return (
      <div className="space-y-2">
        {/* Estado de pago */}
        <div className="rounded-xl p-3 space-y-2"
          style={pagada
            ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
            : { background: 'rgba(99,130,255,0.06)', border: '1px solid rgba(99,130,255,0.2)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {pagada
                ? <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#34d399' }} />
                : <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#8899ff' }} />}
              <div>
                <p className="text-sm font-semibold" style={{ color: pagada ? '#34d399' : '#8899ff' }}>
                  {pagada ? 'Factura pagada ✅' : 'Factura creada — pago pendiente'}
                </p>
                {invoiceNum && (
                  <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{invoiceNum}</p>
                )}
              </div>
            </div>
            {zohoUrl && (
              <a href={zohoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <ExternalLink className="h-3 w-3" />
                Ver en Zoho
              </a>
            )}
          </div>

          {/* Botón sincronizar */}
          <button
            type="button"
            onClick={handleSincronizar}
            disabled={sincronizando}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {sincronizando
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando Zoho...</>
              : <><RefreshCw className="h-3.5 w-3.5" />Sincronizar estado de pago</>}
          </button>

          {syncMsg && (
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>{syncMsg}</p>
          )}
        </div>

        {error && (
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Sin factura aún ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <button
        onClick={handleCrear}
        disabled={cargando || !costoServicio}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(99,130,255,0.12)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.3)' }}
      >
        {cargando
          ? <><Loader2 className="h-4 w-4 animate-spin" />Creando en Zoho...</>
          : <><FileText className="h-4 w-4" />Crear factura en Zoho Inventory</>}
      </button>

      {!costoServicio && (
        <p className="text-xs text-center" style={{ color: '#F5B800' }}>
          ⚠️ Calcula el costo del servicio primero
        </p>
      )}

      {error && (
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
