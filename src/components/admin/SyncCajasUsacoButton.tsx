'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

const tw = 'rgba(255,255,255,'

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  GuiaCreadaColaborador:  { label: 'Guía creada',             color: `${tw}0.45)` },
  'Pre-Alertado':         { label: 'Pre-alertado',            color: `${tw}0.45)` },
  RecibidoOrigen:         { label: 'Recibido en Miami',       color: '#818cf8'    },
  IncluidoEnGuia:         { label: 'Incluido en guía',        color: '#818cf8'    },
  TransitoInternacional:  { label: 'En tránsito internacional', color: '#f59e0b'  },
  ProcesoDeAduana:        { label: 'En proceso de aduana',    color: '#f59e0b'    },
  BodegaDestino:          { label: '🇨🇴 Llegó a Colombia',    color: '#34d399'    },
  EnRuta:                 { label: '🇨🇴 En ruta Colombia',    color: '#34d399'    },
  'En ruta transito':     { label: '🇨🇴 En tránsito Colombia', color: '#34d399'   },
  EnTransportadora:       { label: '🇨🇴 Con transportadora',  color: '#34d399'    },
  EntregaFallida:         { label: '⚠️ Entrega fallida',      color: '#f87171'    },
  Entregado:              { label: '✅ Entregado',             color: '#34d399'    },
}

type Detalle = { caja: string; estadoUsaco: string; llegoColombia: boolean }

type Resultado = {
  consultadas: number
  actualizadas: number
  paquetes_notificados: number
  mensaje?: string
  detalles?: Detalle[]
}

type Estado = 'idle' | 'loading' | 'ok' | 'error'

export default function SyncCajasUsacoButton() {
  const [estado,    setEstado]    = useState<Estado>('idle')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error,     setError]     = useState('')
  const router = useRouter()

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

      {/* Resultado */}
      {estado === 'ok' && resultado && (
        <div className="rounded-xl p-3 space-y-2 text-xs"
          style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.08)` }}>

          {resultado.mensaje ? (
            <p style={{ color: `${tw}0.4)` }}>{resultado.mensaje}</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span style={{ color: `${tw}0.4)` }}>
                  {resultado.consultadas} caja{resultado.consultadas !== 1 ? 's' : ''} consultada{resultado.consultadas !== 1 ? 's' : ''}
                </span>
                {resultado.actualizadas > 0 && (
                  <span style={{ color: '#34d399' }}>
                    {resultado.actualizadas} actualizada{resultado.actualizadas !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {resultado.paquetes_notificados > 0 && (
                <p style={{ color: '#34d399' }}>
                  📦 {resultado.paquetes_notificados} paquete{resultado.paquetes_notificados !== 1 ? 's' : ''} notificado{resultado.paquetes_notificados !== 1 ? 's' : ''} con llegó a Colombia
                </p>
              )}

              {/* Detalle por caja */}
              {(resultado.detalles ?? []).length > 0 && (
                <div className="space-y-1 pt-1" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                  {resultado.detalles!.map(d => {
                    const info = ESTADO_LABELS[d.estadoUsaco] ?? { label: d.estadoUsaco, color: `${tw}0.4)` }
                    return (
                      <div key={d.caja} className="flex items-center justify-between gap-2">
                        <span style={{ color: `${tw}0.35)` }} className="font-mono truncate">{d.caja}</span>
                        <span className="shrink-0" style={{ color: info.color }}>{info.label}</span>
                      </div>
                    )
                  })}
                </div>
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
